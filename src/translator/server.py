"""FastAPI application and WebSocket hub adapted from official google-gemini/gemini-live-api-examples."""

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
from pydantic import BaseModel

from translator.config import ROOT, settings
from translator.live_translate import GeminiLiveTranslator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wedding_translator.server")

app = FastAPI(
    title="Wedding Speech Translator (Gemini Live)",
    description="Real-time Chinese to English speech translation powered by Gemini Live API.",
    version="0.2.0",
)

# Enable CORS for local and web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SubtitleRecord(BaseModel):
    """A single finalized subtitle entry."""

    id: int
    chinese: str
    english: str
    timestamp: str


class BroadcastHub:
    """Manages connected subtitle subscribers (projector, admin, mobile)."""

    def __init__(self):
        self._active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._active_connections.add(websocket)
        logger.info(
            f"Subtitle subscriber connected. Total subscribers: {len(self._active_connections)}"
        )

    def disconnect(self, websocket: WebSocket) -> None:
        self._active_connections.discard(websocket)
        logger.info(
            f"Subtitle subscriber disconnected. Remaining: {len(self._active_connections)}"
        )

    async def broadcast(self, data: dict[str, Any]) -> None:
        if not self._active_connections:
            return

        message = json.dumps(data, ensure_ascii=False)
        connections = list(self._active_connections)

        async def _send(conn: WebSocket):
            try:
                await conn.send_text(message)
                return None
            except Exception:
                return conn

        results = await asyncio.gather(
            *[_send(c) for c in connections], return_exceptions=True
        )
        for res in results:
            if isinstance(res, WebSocket):
                self._active_connections.discard(res)


# Global state singletons
hub = BroadcastHub()
transcript_history: list[SubtitleRecord] = []
is_session_active = False


def calculate_pcm_level(pcm_data: bytes) -> float:
    """Calculate RMS energy level (0-100%) from 16-bit linear PCM audio."""
    if len(pcm_data) < 2:
        return 0.0
    count = len(pcm_data) // 2
    samples = struct.unpack(f"<{count}h", pcm_data[: count * 2])
    sum_squares = sum(s * s for s in samples)
    rms = math.sqrt(sum_squares / count)
    return min(100.0, round((rms / 32768.0) * 100.0, 1))


async def handle_live_event(
    event: dict[str, Any], speaker_ws: WebSocket | None = None
) -> None:
    """Handle events emitted by the Gemini Live Translation API and broadcast to all screens."""
    event_type = event.get("type")

    if event_type == "final":
        record = SubtitleRecord(
            id=event["id"],
            chinese=event["chinese"],
            english=event["english"],
            timestamp=event["timestamp"],
        )
        transcript_history.append(record)
    elif event_type == "session_status" and event.get("status") == "connected":
        # Normalize status to 'live' for frontend indicator compatibility
        event = {**event, "status": "live"}

    # Broadcast event to all connected subtitle displays
    await hub.broadcast(event)


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
    return HTMLResponse("<h1>Wedding Translator (Gemini Live) is running</h1>")


@app.get("/test", response_class=HTMLResponse)
async def get_test_page():
    """Serve the interactive microphone testing console."""
    if TEST_HTML_PATH.exists():
        return HTMLResponse(content=TEST_HTML_PATH.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>Wedding Translator (Gemini Live) is running</h1>")


@app.get("/api/health")
async def health_check():
    """Verify backend and Gemini Live configuration."""
    return {
        "status": "ok",
        "project_id": settings.gcp_project_id,
        "location": settings.gcp_location,
        "transcribe_model": settings.transcribe_model,
        "translation_model": settings.translation_model,
        "source_language": settings.source_language_description,
        "target_language": settings.target_language,
        "subscribers_count": len(hub._active_connections),
        "is_session_active": is_session_active,
    }


@app.get("/api/config")
async def get_config():
    """Get active configuration."""
    return {
        "project_id": settings.gcp_project_id,
        "location": settings.gcp_location,
        "transcribe_model": settings.transcribe_model,
        "translation_model": settings.translation_model,
        "source_language": settings.source_language_description,
        "target_language": settings.target_language,
        "wedding": settings.wedding.model_dump(),
        "enable_live_audio_stream": settings.enable_live_audio_stream,
    }


@app.get("/api/transcript/export")
async def export_transcript(format: str = "markdown"):
    """Export complete speech transcript as Markdown or CSV."""
    if format == "csv":
        lines = ["id,timestamp,chinese,english"]
        for r in transcript_history:
            lines.append(f'{r.id},"{r.timestamp}","{r.chinese}","{r.english}"')
        content = "\n".join(lines)
        return PlainTextResponse(
            content,
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=wedding_transcript.csv"
            },
        )

    # Markdown format
    lines = [
        f"# Wedding Speech Transcript: {settings.wedding.bride_name} & {settings.wedding.groom_name}",
        f"**Date**: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"**Engine**: Two-Step Transcribe & Translate ({settings.transcribe_model} + {settings.translation_model})",
        "",
        "---",
        "",
    ]
    for r in transcript_history:
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
    transcript_history.clear()
    await hub.broadcast({"type": "transcript_cleared"})
    return {"status": "cleared"}


@app.websocket("/ws/subtitles")
async def websocket_subtitles(websocket: WebSocket):
    """WebSocket endpoint for audience screens, projector, and mobile clients to receive subtitles."""
    await hub.connect(websocket)
    try:
        # Send initial state and existing transcript history upon connection
        await websocket.send_text(
            json.dumps(
                {
                    "type": "init",
                    "history": [r.model_dump() for r in transcript_history],
                    "transcribe_model": settings.transcribe_model,
                    "translation_model": settings.translation_model,
                    "source_language": settings.source_language_description,
                    "target_language": settings.target_language,
                    "wedding": settings.wedding.model_dump(),
                },
                ensure_ascii=False,
            )
        )

        # Keep connection open and respond to client pings
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        hub.disconnect(websocket)
    except Exception as e:
        logger.warning(f"Subtitle subscriber error: {e}")
        hub.disconnect(websocket)


@app.websocket("/ws")
@app.websocket("/ws/speaker")
async def websocket_speaker(websocket: WebSocket):
    """WebSocket endpoint for Gemini Live streaming, following official Python SDK pattern."""
    await websocket.accept()
    logger.info("Speaker audio WebSocket accepted")

    audio_input_queue: asyncio.Queue[bytes] = asyncio.Queue()
    text_input_queue: asyncio.Queue[str] = asyncio.Queue()

    async def audio_output_callback(data: bytes):
        if settings.enable_live_audio_stream:
            try:
                await websocket.send_bytes(data)
            except Exception as e:
                logger.debug(f"Failed to send audio bytes to client: {e}")

    async def audio_interrupt_callback():
        await hub.broadcast({"type": "interrupted"})

    translator = GeminiLiveTranslator()
    last_rms_time = 0.0

    async def receive_from_client():
        nonlocal last_rms_time
        try:
            while True:
                message = await websocket.receive()
                msg_type = message.get("type")
                if msg_type == "websocket.disconnect":
                    logger.info("Speaker WebSocket client disconnected")
                    break

                if message.get("bytes"):
                    pcm_data = message["bytes"]

                    # Fast path: immediately queue audio for Gemini Live without waiting
                    await audio_input_queue.put(pcm_data)

                    # Compute VU level for live UI meter (background broadcast without delaying audio stream)
                    now = time.time()
                    if now - last_rms_time >= 0.15:
                        last_rms_time = now
                        level = calculate_pcm_level(pcm_data)
                        asyncio.create_task(
                            hub.broadcast({"type": "audio_level", "level": level})
                        )

                elif message.get("text"):
                    text = message["text"]
                    logger.debug(f"Received text message from client: {text}")
                    await text_input_queue.put(text)

        except (WebSocketDisconnect, asyncio.CancelledError):
            logger.info("Speaker WebSocket receive task stopped")
        except Exception as e:
            logger.error(f"Error receiving from speaker client: {e}")

    async def run_session():
        global is_session_active
        is_session_active = True
        try:
            async for event in translator.start_session(
                audio_input_queue=audio_input_queue,
                text_input_queue=text_input_queue,
                audio_output_callback=audio_output_callback,
                audio_interrupt_callback=audio_interrupt_callback,
            ):
                if event:
                    await handle_live_event(event)
        except (asyncio.CancelledError, GeneratorExit):
            pass
        except Exception as e:
            logger.error(f"Error in Gemini Live session: {type(e).__name__}: {e}")
        finally:
            is_session_active = False

    receive_task = asyncio.create_task(receive_from_client())
    session_task = asyncio.create_task(run_session())

    try:
        # Wait until either the client disconnects or the Gemini session finishes
        await asyncio.wait(
            [receive_task, session_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
    finally:
        receive_task.cancel()
        session_task.cancel()
        await asyncio.gather(receive_task, session_task, return_exceptions=True)
        await hub.broadcast({"type": "session_status", "status": "idle"})
        await hub.broadcast({"type": "audio_level", "level": 0.0})
        try:
            await websocket.close()
        except Exception as e:
            logger.debug(f"Error closing speaker WebSocket: {e}")
