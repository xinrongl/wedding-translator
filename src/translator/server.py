"""FastAPI application and WebSocket hub for the Wedding Translator service."""

import asyncio
import json
import logging
import math
import struct
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from google.auth.transport import requests as google_auth_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel

from translator.config import ROOT, settings
from translator.live_translate import GeminiLiveTranslator, LiveEvent

logger = logging.getLogger("wedding_translator.server")

# Reused across requests: fetches and caches Google's public signing keys.
_google_auth_transport = google_auth_requests.Request()


def verify_speaker_identity(token: str) -> str | None:
    """Verify a 'Sign in with Google' ID token against the approved speaker allowlist.

    Args:
        token: Google OAuth ID token string.

    Returns:
        Verified email address if authorized, otherwise None.
    """
    if not token:
        return None
    try:
        claims = google_id_token.verify_oauth2_token(
            token, _google_auth_transport, settings.google_oauth_client_id
        )
    except Exception as exc:
        logger.warning("Speaker ID token verification failed: %s", exc)
        return None

    email = (claims.get("email") or "").lower()
    if not claims.get("email_verified") or email not in settings.speaker_allowed_emails_set:
        logger.warning(
            "Speaker WebSocket rejected: '%s' is not in approved allowlist",
            email or "unknown",
        )
        return None
    return email


class SubtitleRecord(BaseModel):
    """A single finalized subtitle segment."""

    id: int
    chinese: str
    english: str
    timestamp: str


class BroadcastHub:
    """Thread-safe WebSocket manager distributing subtitle events to audience displays."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        logger.info("Subtitle subscriber connected. Total active: %d", len(self._connections))

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)
        logger.info("Subtitle subscriber disconnected. Remaining: %d", len(self._connections))

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Broadcast JSON message concurrently to all subscribers, pruning dead sockets."""
        if not self._connections:
            return

        message = json.dumps(data, ensure_ascii=False)
        async with self._lock:
            targets = list(self._connections)

        dead_connections: list[WebSocket] = []

        async def _send(ws: WebSocket) -> None:
            try:
                await ws.send_text(message)
            except Exception:
                dead_connections.append(ws)

        await asyncio.gather(*[_send(ws) for ws in targets], return_exceptions=True)

        if dead_connections:
            async with self._lock:
                for dead in dead_connections:
                    self._connections.discard(dead)


class SessionManager:
    """Coordinates single-active-speaker concurrency and live transcript history."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self.is_active = False
        self.history: list[SubtitleRecord] = []
        self.session_number: int = 1
        self.session_id: str = f"session_{int(time.time())}"
        self.session_title: str = "Ceremony Speeches"
        self.session_start_time: float = time.time()

    async def acquire_speaker_session(self) -> bool:
        """Attempt to acquire the exclusive speaker lock."""
        async with self._lock:
            if self.is_active:
                return False
            self.is_active = True
            return True

    async def release_speaker_session(self) -> None:
        """Release the exclusive speaker lock."""
        async with self._lock:
            self.is_active = False

    def add_record(self, record: SubtitleRecord) -> None:
        self.history.append(record)

    def clear_history(self) -> None:
        self.history.clear()

    def start_new_session(self, title: str | None = None) -> dict[str, Any]:
        """Reset transcript history and advance to a new translation session."""
        self.history.clear()
        self.session_number += 1
        self.session_id = f"session_{int(time.time())}"
        self.session_title = title.strip() if title and title.strip() else f"Speech Session #{self.session_number}"
        self.session_start_time = time.time()
        return {
            "session_id": self.session_id,
            "session_number": self.session_number,
            "session_title": self.session_title,
            "session_start_time": self.session_start_time,
        }


# Application singletons
hub = BroadcastHub()
session_manager = SessionManager()

app = FastAPI(
    title="Wedding Speech Translator (Gemini 3.8 Live)",
    description="Real-time Chinese-to-English speech translation powered by Gemini 3.8 Live.",
    version=settings.version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def calculate_pcm_level(pcm_data: bytes) -> float:
    """Calculate RMS energy level (0.0 to 100.0) from 16-bit linear PCM audio."""
    if len(pcm_data) < 2:
        return 0.0
    count = len(pcm_data) // 2
    samples = struct.unpack(f"<{count}h", pcm_data[: count * 2])
    sum_squares = sum(s * s for s in samples)
    rms = math.sqrt(sum_squares / count)
    return min(100.0, round((rms / 32768.0) * 100.0, 1))


async def handle_live_event(event: LiveEvent) -> None:
    """Process an event emitted by Gemini 3.8 Live and broadcast to audience screens."""
    event_type = event.get("type")

    if event_type == "final":
        record = SubtitleRecord(
            id=event.get("id", len(session_manager.history) + 1),
            chinese=event.get("chinese", ""),
            english=event.get("english", ""),
            timestamp=event.get("timestamp", time.strftime("%H:%M:%S")),
        )
        session_manager.add_record(record)
    elif event_type == "session_status" and event.get("status") == "connected":
        event = {**event, "status": "live"}

    await hub.broadcast(event)


# Frontend static files routing
STATIC_DIR = Path(__file__).parent / "static"
TEST_HTML_PATH = STATIC_DIR / "test.html"


def _resolve_frontend_dist() -> Path:
    candidates = [
        ROOT / "src" / "app" / "dist",
        Path.cwd() / "src" / "app" / "dist",
        Path("/app/src/app/dist"),
        Path(__file__).parent.parent / "app" / "dist",
    ]
    for p in candidates:
        if p.exists() and (p / "index.html").exists():
            return p
    return ROOT / "src" / "app" / "dist"


FRONTEND_DIST_DIR = _resolve_frontend_dist()

if FRONTEND_DIST_DIR.exists() and (FRONTEND_DIST_DIR / "assets").exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST_DIR / "assets")),
        name="frontend-assets",
    )


@app.get("/", response_class=HTMLResponse)
@app.get("/projector", response_class=HTMLResponse)
@app.get("/speaker", response_class=HTMLResponse)
@app.get("/mobile", response_class=HTMLResponse)
async def get_frontend_page():
    """Serve the React + TypeScript frontend application."""
    index_html = FRONTEND_DIST_DIR / "index.html"
    if index_html.exists():
        return FileResponse(index_html)
    if TEST_HTML_PATH.exists():
        return HTMLResponse(content=TEST_HTML_PATH.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>Wedding Translator (Gemini 3.8 Live) is running</h1>")


@app.get("/test", response_class=HTMLResponse)
async def get_test_page():
    """Serve the interactive microphone testing console."""
    if TEST_HTML_PATH.exists():
        return HTMLResponse(content=TEST_HTML_PATH.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>Wedding Translator (Gemini 3.8 Live) is running</h1>")


@app.get("/api/health")
async def health_check():
    """Return backend status and active model configuration."""
    return {
        "status": "ok",
        "live_model": settings.live_model,
        "use_vertex": settings.use_vertex,
        "project_id": settings.google_cloud_project,
        "location": settings.google_cloud_location,
        "source_language": settings.source_language_description,
        "target_language": settings.target_language,
        "subscribers_count": hub.connection_count,
        "is_session_active": session_manager.is_active,
    }


class NewSessionPayload(BaseModel):
    title: str | None = None


@app.get("/api/config")
async def get_config():
    """Return public application configuration."""
    return {
        "project_id": settings.google_cloud_project,
        "location": settings.google_cloud_location,
        "live_model": settings.live_model,
        "use_vertex": settings.use_vertex,
        "source_language": settings.source_language_description,
        "target_language": settings.target_language,
        "wedding": settings.wedding.model_dump(),
        "google_oauth_client_id": settings.google_oauth_client_id,
        "session_id": session_manager.session_id,
        "session_number": session_manager.session_number,
        "session_title": session_manager.session_title,
    }


@app.get("/api/transcript/export")
async def export_transcript(format: str = "markdown"):
    """Export complete speech transcript as Markdown or CSV."""
    if format == "csv":
        lines = ["id,timestamp,chinese,english"]
        for r in session_manager.history:
            lines.append(f'{r.id},"{r.timestamp}","{r.chinese}","{r.english}"')
        return PlainTextResponse(
            "\n".join(lines),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=wedding_transcript.csv"},
        )

    lines = [
        f"# Wedding Speech Transcript: {settings.wedding.bride_name} & {settings.wedding.groom_name}",
        f"**Date**: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"**Session**: #{session_manager.session_number} ({session_manager.session_title})",
        f"**Engine**: Gemini 3.8 Live 1-Step Real-Time Speech Translation ({settings.live_model})",
        "",
        "---",
        "",
    ]
    for r in session_manager.history:
        lines.append(f"**[{r.timestamp}] #{r.id}**")
        lines.append(f"> 🇨🇳 {r.chinese}")
        lines.append(f"> 🇬🇧 {r.english}")
        lines.append("")

    return PlainTextResponse(
        "\n".join(lines),
        media_type="text/markdown",
        headers={"Content-Disposition": "attachment; filename=wedding_transcript.md"},
    )


@app.post("/api/transcript/clear")
async def clear_transcript():
    """Clear transcript history for a new speaker."""
    session_manager.clear_history()
    await hub.broadcast({"type": "transcript_cleared"})
    return {"status": "cleared"}


@app.post("/api/session/new")
async def create_new_session(payload: NewSessionPayload | None = None):
    """Start a new translation session, clearing transcript and broadcasting new session info."""
    title = payload.title if payload else None
    session_info = session_manager.start_new_session(title=title)
    await hub.broadcast(
        {
            "type": "new_session",
            **session_info,
            "timestamp": time.strftime("%H:%M:%S"),
        }
    )
    return {"status": "ok", **session_info}


@app.websocket("/ws/subtitles")
async def websocket_subtitles(websocket: WebSocket):
    """Audience WebSocket feed for projector, console, and mobile guests."""
    await hub.connect(websocket)
    try:
        # Send initial snapshot upon connection
        await websocket.send_text(
            json.dumps(
                {
                    "type": "init",
                    "history": [r.model_dump() for r in session_manager.history],
                    "live_model": settings.live_model,
                    "use_vertex": settings.use_vertex,
                    "source_language": settings.source_language_description,
                    "target_language": settings.target_language,
                    "wedding": settings.wedding.model_dump(),
                    "session_id": session_manager.session_id,
                    "session_number": session_manager.session_number,
                    "session_title": session_manager.session_title,
                },
                ensure_ascii=False,
            )
        )

        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await hub.disconnect(websocket)
    except Exception as exc:
        logger.warning("Subtitle subscriber error: %s", exc)
        await hub.disconnect(websocket)


@app.websocket("/ws")
@app.websocket("/ws/speaker")
async def websocket_speaker(websocket: WebSocket):
    """Speaker audio streaming WebSocket endpoint."""
    await websocket.accept()

    # Optional Google Identity authentication
    verified_email: str | None = None
    if settings.google_oauth_client_id:
        provided_token = websocket.query_params.get("id_token", "")
        verified_email = verify_speaker_identity(provided_token)
        if not verified_email:
            await websocket.close(
                code=4401,
                reason="Sign in with an approved Google account to start streaming",
            )
            return

    acquired = await session_manager.acquire_speaker_session()
    if not acquired:
        logger.warning("Speaker connection rejected: another speaker session is active")
        await websocket.close(code=4409, reason="A speaker session is already active")
        return

    logger.info(
        "Speaker audio WebSocket accepted%s",
        f" for {verified_email}" if verified_email else "",
    )

    audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
    text_queue: asyncio.Queue[str] = asyncio.Queue()
    translator = GeminiLiveTranslator()

    async def audio_interrupt_callback() -> None:
        await hub.broadcast({"type": "interrupted"})

    last_rms_time = 0.0

    async def receive_from_client() -> None:
        nonlocal last_rms_time
        try:
            while True:
                message = await websocket.receive()
                msg_type = message.get("type")
                if msg_type == "websocket.disconnect":
                    break

                if pcm_data := message.get("bytes"):
                    await audio_queue.put(pcm_data)

                    now = time.time()
                    if now - last_rms_time >= 0.15:
                        last_rms_time = now
                        level = calculate_pcm_level(pcm_data)
                        await hub.broadcast({"type": "audio_level", "level": level})

                elif text := message.get("text"):
                    await text_queue.put(text)
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception as exc:
            logger.error("Error receiving from speaker client: %s", exc)

    async def run_translator() -> None:
        try:
            async for event in translator.start_session(
                audio_input_queue=audio_queue,
                text_input_queue=text_queue,
                audio_interrupt_callback=audio_interrupt_callback,
            ):
                if event:
                    await handle_live_event(event)
        except (asyncio.CancelledError, GeneratorExit):
            pass
        except Exception:
            logger.exception("Error in live translation session")

    receive_task = asyncio.create_task(receive_from_client())
    translator_task = asyncio.create_task(run_translator())

    try:
        done, _ = await asyncio.wait(
            [receive_task, translator_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for completed_task in done:
            name = (
                "client_audio_input"
                if completed_task is receive_task
                else "gemini_live_session"
            )
            if exc := completed_task.exception():
                logger.error("Speaker task '%s' ended with error: %s", name, exc)
            else:
                logger.info("Speaker task '%s' completed", name)
    finally:
        receive_task.cancel()
        translator_task.cancel()
        await asyncio.gather(receive_task, translator_task, return_exceptions=True)
        await session_manager.release_speaker_session()
        await hub.broadcast({"type": "session_status", "status": "idle"})
        await hub.broadcast({"type": "audio_level", "level": 0.0})
        try:
            await websocket.close()
        except Exception as exc:
            logger.debug("Closing speaker WebSocket finished with: %s", exc)
