"""Comprehensive unit and integration test suite for the Wedding Translator."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from translator.config import (
    AudioConfig,
    Settings,
    WeddingContext,
    build_wedding_translation_instruction,
    settings,
)
from translator.live_translate import GeminiLiveTranslator, create_translator
from translator.server import (
    BroadcastHub,
    SessionManager,
    SubtitleRecord,
    app,
    calculate_pcm_level,
    verify_speaker_identity,
)


@pytest.mark.smoke
def test_audio_config():
    """Verify audio frame byte calculations for 16kHz 16-bit mono."""
    cfg = AudioConfig(sample_rate=16000, chunk_duration_ms=50, bytes_per_sample=2)
    # 16000 * 0.05 * 2 = 1600 bytes per 50ms chunk
    assert cfg.chunk_size_bytes == 1600


@pytest.mark.smoke
def test_calculate_pcm_level():
    """Verify RMS calculation produces zero on silence and positive on audio."""
    silence = b"\x00\x00" * 1600
    assert calculate_pcm_level(silence) == 0.0

    loud = b"\xff\x7f" * 1600
    assert calculate_pcm_level(loud) > 50.0


@pytest.mark.smoke
def test_api_health_and_config():
    """Verify REST endpoints for health check, config retrieval, and export."""
    client = TestClient(app)

    # 1. Health check
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["live_model"] == "gemini-3.8-live"
    assert isinstance(data["use_vertex"], bool)
    assert data["location"] == settings.google_cloud_location

    # 2. Config get
    resp = client.get("/api/config")
    assert resp.status_code == 200
    config_data = resp.json()
    assert config_data["live_model"] == "gemini-3.8-live"
    assert "wedding" in config_data

    # 3. Export transcript
    resp = client.get("/api/transcript/export?format=markdown")
    assert resp.status_code == 200
    assert "Wedding Speech Transcript" in resp.text
    assert "Gemini 3.8 Live" in resp.text

    # 4. Clear transcript
    resp = client.post("/api/transcript/clear")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cleared"

    # 5. New session
    resp = client.post("/api/session/new", json={"title": "Vows Ceremony"})
    assert resp.status_code == 200
    sess_data = resp.json()
    assert sess_data["status"] == "ok"
    assert sess_data["session_title"] == "Vows Ceremony"
    assert "session_id" in sess_data
    assert "session_number" in sess_data


@pytest.mark.asyncio
async def test_gemini_live_session_lifecycle():
    """Verify 1-step live streaming session lifecycle, token streaming, and finalization."""
    audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
    translator = GeminiLiveTranslator()

    mock_resp1 = MagicMock()
    mock_resp1.go_away = None
    mock_resp1.server_content.interrupted = False
    mock_resp1.server_content.interim_input_transcription.text = "欣荣和顺顺百年好合"
    mock_resp1.server_content.input_transcription = None
    mock_resp1.server_content.output_transcription = None
    mock_resp1.server_content.model_turn = None
    mock_resp1.server_content.turn_complete = False
    mock_resp1.server_content.generation_complete = False

    mock_resp2 = MagicMock()
    mock_resp2.go_away = None
    mock_resp2.server_content.interrupted = False
    mock_resp2.server_content.interim_input_transcription = None
    mock_resp2.server_content.input_transcription = None
    mock_trans = MagicMock()
    mock_trans.text = "Xinrong and Joy, wishing you a lifetime of love and harmony."
    mock_resp2.server_content.output_transcription = mock_trans
    mock_resp2.server_content.model_turn = None
    mock_resp2.server_content.turn_complete = False
    mock_resp2.server_content.generation_complete = False

    mock_resp3 = MagicMock()
    mock_resp3.go_away = None
    mock_resp3.server_content.interrupted = False
    mock_resp3.server_content.interim_input_transcription = None
    mock_resp3.server_content.input_transcription.text = "欣荣和顺顺百年好合"
    mock_resp3.server_content.output_transcription = None
    mock_resp3.server_content.model_turn = None
    mock_resp3.server_content.turn_complete = True
    mock_resp3.server_content.generation_complete = False

    first_turn_sent = False

    async def mock_receive():
        nonlocal first_turn_sent
        if not first_turn_sent:
            first_turn_sent = True
            yield mock_resp1
            yield mock_resp2
            yield mock_resp3
        else:
            # Simulate waiting for subsequent speech turns
            await asyncio.Event().wait()

    mock_session = MagicMock()
    mock_session.send_realtime_input = AsyncMock()
    mock_session.send_client_content = AsyncMock()
    mock_session.receive = mock_receive

    class MockConnectContext:
        async def __aenter__(self):
            return mock_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            return None

    with patch.object(
        translator.client.aio.live, "connect", return_value=MockConnectContext()
    ):
        events = []

        async def run_session():
            async for event in translator.start_session(audio_input_queue=audio_queue):
                events.append(event)
                if event.get("type") == "final":
                    await audio_queue.put(None)
                    break

        await audio_queue.put(b"\x00\x00" * 1600)
        await asyncio.wait_for(run_session(), timeout=5.0)

        assert any(
            e.get("type") == "session_status" and e.get("status") == "connected"
            for e in events
        )
        assert any(
            e.get("type") == "partial" and "Xinrong and Joy" in e.get("english", "")
            for e in events
        )
        assert any(
            e.get("type") == "final"
            and "Xinrong and Joy" in e.get("english", "")
            and "百年好合" in e.get("chinese", "")
            for e in events
        )


def test_wedding_translation_instruction():
    """Verify build_wedding_translation_instruction generates concise, wedding-tailored translation prompt."""
    ctx = WeddingContext(
        bride_name="Joy",
        groom_name="Xinrong",
        speaker_role="Maid of Honor",
        venue="Stones of the Yarra Valley",
        custom_notes="High school friends since 2012",
    )
    instruction = build_wedding_translation_instruction(ctx)

    assert "English subtitle translator" in instruction
    assert "Joy" in instruction
    assert "Xinrong" in instruction
    assert "Maid of Honor" in instruction
    assert "Stones of the Yarra Valley" in instruction
    assert "High school friends since 2012" in instruction
    assert "Output ONLY English text subtitles" in instruction
    assert "Google Translate Live" in instruction


def test_vocabulary_biasing_and_stt_settings():
    """Verify that wedding vocabulary list contains blessings, roles, names, and venue."""
    ctx = WeddingContext(
        bride_name="Joy",
        groom_name="Xinrong",
        venue="Stones of the Yarra Valley",
        custom_vocabulary="欣荣, 卓怡, 永结同心",
    )
    vocab = ctx.get_vocabulary_list()

    assert "Joy" in vocab
    assert "Xinrong" in vocab
    assert "欣荣" in vocab
    assert "百年好合" in vocab
    assert "新娘" in vocab
    assert "Stones of the Yarra Valley" in vocab
    assert settings.stt_mode in ["SMART", "VERBATIM"]
    assert "zh-CN" in settings.stt_language_codes


@pytest.mark.smoke
def test_frontend_routes():
    """Verify that frontend pages serve correctly."""
    client = TestClient(app)

    for route in ["/", "/projector", "/speaker", "/mobile"]:
        resp = client.get(route)
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert '<div id="root">' in resp.text or "Wedding" in resp.text

    resp_test = client.get("/test")
    assert resp_test.status_code == 200
    assert "Wedding Translator" in resp_test.text


def test_live_model_configuration():
    """Verify Gemini 3.8 Live configuration."""
    assert settings.live_model == "gemini-3.8-live"


def test_use_vertex_resolution():
    """Verify use_vertex property logic across Accenture vs Personal GCP environments."""
    # 1. Explicit override with GOOGLE_GENAI_USE_VERTEXAI
    s1 = Settings(
        google_genai_use_vertexai=True, google_cloud_project="canvas-aviary-302803"
    )
    assert s1.use_vertex is True

    s2 = Settings(
        google_genai_use_vertexai=False,
        google_cloud_project="ktzdeir-agbg-anz-gemini-vertex",
    )
    assert s2.use_vertex is False

    # 2. Auto-detect Accenture Vertex project
    s3 = Settings(
        google_genai_use_vertexai=None,
        google_cloud_project="ktzdeir-agbg-anz-gemini-vertex",
    )
    assert s3.use_vertex is True

    # 3. Auto-detect personal project
    s4 = Settings(
        google_genai_use_vertexai=None, google_cloud_project="canvas-aviary-302803"
    )
    assert s4.use_vertex is False

    # 4. Auto-detect API key with non-vertex project
    s5 = Settings(
        google_genai_use_vertexai=None,
        google_cloud_project=None,
        gemini_api_key="AIzaSyTest",
    )
    assert s5.use_vertex is False


def test_create_translator():
    """Verify translator engine instantiates with Gemini 3.8 Live."""
    translator = create_translator()
    assert isinstance(translator, GeminiLiveTranslator)
    assert translator.live_model == "gemini-3.8-live"


@pytest.mark.asyncio
async def test_session_manager_concurrency():
    """Verify SessionManager enforces single active speaker and manages history."""
    sm = SessionManager()
    assert not sm.is_active

    # First speaker acquires
    assert await sm.acquire_speaker_session() is True
    assert sm.is_active is True

    # Second speaker is rejected
    assert await sm.acquire_speaker_session() is False

    # Record history
    sm.add_record(
        SubtitleRecord(id=1, chinese="你好", english="Hello", timestamp="12:00:00")
    )
    assert len(sm.history) == 1
    assert sm.history[0].english == "Hello"

    # First speaker releases
    await sm.release_speaker_session()
    assert sm.is_active is False

    # Second speaker can now acquire
    assert await sm.acquire_speaker_session() is True
    await sm.release_speaker_session()

    # Clear history
    sm.clear_history()
    assert len(sm.history) == 0


@pytest.mark.asyncio
async def test_broadcast_hub():
    """Verify BroadcastHub connection counting and broadcasting."""
    hub = BroadcastHub()
    mock_ws = AsyncMock()

    await hub.connect(mock_ws)
    assert hub.connection_count == 1

    await hub.broadcast({"type": "test_msg"})
    mock_ws.send_text.assert_called_once()

    await hub.disconnect(mock_ws)
    assert hub.connection_count == 0


def test_speaker_allowed_emails_set_normalizes():
    """Verify the allowlist is trimmed, lowercased, and drops blanks."""
    s = Settings(speaker_allowed_emails=" Approved@Example.com, second@example.com ,")
    assert s.speaker_allowed_emails_set == {
        "approved@example.com",
        "second@example.com",
    }


def test_verify_speaker_identity_rejects_missing_token():
    """No token provided should never verify, regardless of Google's response."""
    assert verify_speaker_identity("") is None


def test_verify_speaker_identity_rejects_invalid_signature():
    """A token that fails Google's signature/audience/expiry check is rejected."""
    with patch(
        "translator.server.google_id_token.verify_oauth2_token",
        side_effect=ValueError("invalid token"),
    ):
        assert verify_speaker_identity("garbage") is None


def test_verify_speaker_identity_rejects_unverified_email(monkeypatch):
    """A structurally valid token for an unverified email address is rejected."""
    monkeypatch.setattr(settings, "speaker_allowed_emails", "approved@example.com")
    with patch(
        "translator.server.google_id_token.verify_oauth2_token",
        return_value={"email": "approved@example.com", "email_verified": False},
    ):
        assert verify_speaker_identity("token") is None


def test_verify_speaker_identity_rejects_unapproved_account():
    """A verified Google account that isn't on the allowlist is rejected."""
    with patch(
        "translator.server.google_id_token.verify_oauth2_token",
        return_value={"email": "stranger@example.com", "email_verified": True},
    ):
        assert verify_speaker_identity("token") is None


def test_verify_speaker_identity_accepts_approved_account(monkeypatch):
    """A verified, allowlisted Google account is accepted (case-insensitively)."""
    monkeypatch.setattr(settings, "speaker_allowed_emails", "Approved@Example.com")
    with patch(
        "translator.server.google_id_token.verify_oauth2_token",
        return_value={"email": "approved@example.com", "email_verified": True},
    ):
        assert verify_speaker_identity("token") == "approved@example.com"


@pytest.mark.asyncio
async def test_gemini_live_barge_in_interruption_preserves_subtitle():
    """Verify that user barge-in (interrupted=True) finalizes and preserves accumulated speech instead of discarding it."""
    audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
    translator = GeminiLiveTranslator()

    mock_resp_input = MagicMock()
    mock_resp_input.go_away = None
    mock_resp_input.server_content.interrupted = False
    mock_resp_input.server_content.interim_input_transcription = None
    mock_resp_input.server_content.input_transcription.text = (
        "这个 translation 是不是有用的问题?"
    )
    mock_resp_input.server_content.output_transcription = None
    mock_resp_input.server_content.model_turn = None
    mock_resp_input.server_content.turn_complete = False
    mock_resp_input.server_content.generation_complete = False

    mock_resp_trans = MagicMock()
    mock_resp_trans.go_away = None
    mock_resp_trans.server_content.interrupted = False
    mock_resp_trans.server_content.interim_input_transcription = None
    mock_resp_trans.server_content.input_transcription = None
    mock_t = MagicMock()
    mock_t.text = "Is this translation useful?"
    mock_resp_trans.server_content.output_transcription = mock_t
    mock_resp_trans.server_content.model_turn = None
    mock_resp_trans.server_content.turn_complete = False
    mock_resp_trans.server_content.generation_complete = False

    # Speaker begins next sentence -> barge-in triggered
    mock_resp_interrupted = MagicMock()
    mock_resp_interrupted.go_away = None
    mock_resp_interrupted.server_content.interrupted = True
    mock_resp_interrupted.server_content.interim_input_transcription = None
    mock_resp_interrupted.server_content.input_transcription = None
    mock_resp_interrupted.server_content.output_transcription = None
    mock_resp_interrupted.server_content.model_turn = None
    mock_resp_interrupted.server_content.turn_complete = False
    mock_resp_interrupted.server_content.generation_complete = False

    turn_done = False

    async def mock_receive():
        nonlocal turn_done
        if not turn_done:
            turn_done = True
            yield mock_resp_input
            yield mock_resp_trans
            yield mock_resp_interrupted
        else:
            await asyncio.Event().wait()

    mock_session = MagicMock()
    mock_session.send_realtime_input = AsyncMock()
    mock_session.send_client_content = AsyncMock()
    mock_session.receive = mock_receive

    class MockConnectContext:
        async def __aenter__(self):
            return mock_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            return None

    with patch.object(
        translator.client.aio.live, "connect", return_value=MockConnectContext()
    ):
        events = []

        async def run_session():
            async for event in translator.start_session(audio_input_queue=audio_queue):
                events.append(event)
                if event.get("type") == "final":
                    await audio_queue.put(None)
                    break

        await audio_queue.put(b"\x00\x00" * 1600)
        await asyncio.wait_for(run_session(), timeout=5.0)

        # Confirm that the interrupted sentence was successfully committed as a FINAL subtitle
        finals = [e for e in events if e.get("type") == "final"]
        assert len(finals) == 1
        assert "translation" in finals[0]["chinese"]
        assert "useful" in finals[0]["english"]


@pytest.mark.asyncio
async def test_gemini_live_utterance_transition_commits_prior_sentence():
    """Verify that when a new utterance starts while prior speech is translated, prior sentence is committed."""
    audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
    translator = GeminiLiveTranslator()

    mock_resp1 = MagicMock()
    mock_resp1.go_away = None
    mock_resp1.server_content.interrupted = False
    mock_resp1.server_content.interim_input_transcription = None
    mock_resp1.server_content.input_transcription.text = "句子一"
    mock_t1 = MagicMock()
    mock_t1.text = "Sentence One."
    mock_resp1.server_content.output_transcription = mock_t1
    mock_resp1.server_content.model_turn = None
    mock_resp1.server_content.turn_complete = False
    mock_resp1.server_content.generation_complete = False

    # New sentence arrives without explicit turn_complete
    mock_resp2 = MagicMock()
    mock_resp2.go_away = None
    mock_resp2.server_content.interrupted = False
    mock_interim = MagicMock()
    mock_interim.text = "句子二开始说话"
    mock_resp2.server_content.interim_input_transcription = mock_interim
    mock_resp2.server_content.input_transcription = None
    mock_resp2.server_content.output_transcription = None
    mock_resp2.server_content.model_turn = None
    mock_resp2.server_content.turn_complete = False
    mock_resp2.server_content.generation_complete = False

    turn_done = False

    async def mock_receive():
        nonlocal turn_done
        if not turn_done:
            turn_done = True
            yield mock_resp1
            yield mock_resp2
        else:
            await asyncio.Event().wait()

    mock_session = MagicMock()
    mock_session.send_realtime_input = AsyncMock()
    mock_session.send_client_content = AsyncMock()
    mock_session.receive = mock_receive

    class MockConnectContext:
        async def __aenter__(self):
            return mock_session

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            return None

    with patch.object(
        translator.client.aio.live, "connect", return_value=MockConnectContext()
    ):
        events = []

        async def run_session():
            async for event in translator.start_session(audio_input_queue=audio_queue):
                events.append(event)
                if event.get("type") == "final":
                    await audio_queue.put(None)
                    break

        await audio_queue.put(b"\x00\x00" * 1600)
        await asyncio.wait_for(run_session(), timeout=5.0)

        finals = [e for e in events if e.get("type") == "final"]
        assert len(finals) == 1
        assert finals[0]["chinese"] == "句子一"
        assert finals[0]["english"] == "Sentence One."


def test_speaker_ws_rejected_when_oauth_client_id_unset(monkeypatch):
    """Without GOOGLE_OAUTH_CLIENT_ID the speaker gate fails closed instead of admitting anyone."""
    from starlette.websockets import WebSocketDisconnect

    monkeypatch.setattr(settings, "google_oauth_client_id", None)
    client = TestClient(app)
    with client.websocket_connect("/ws/speaker") as ws:
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_text()
    assert exc.value.code == 4401


def test_speaker_ws_rejected_without_id_token(monkeypatch):
    """With the gate configured, a connection without an ID token is rejected."""
    from starlette.websockets import WebSocketDisconnect

    monkeypatch.setattr(settings, "google_oauth_client_id", "client-id.apps.googleusercontent.com")
    client = TestClient(app)
    with client.websocket_connect("/ws/speaker") as ws:
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_text()
    assert exc.value.code == 4401
