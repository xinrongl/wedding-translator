"""Comprehensive test suite for the Wedding Translator backend (Two-Step Transcribe Architecture)."""

import pytest
from fastapi.testclient import TestClient

from translator.config import (
    AudioConfig,
    WeddingContext,
    build_wedding_translation_instruction,
    settings,
)
from translator.live_translate import GeminiLiveTranslator, create_translator
from translator.server import app, calculate_pcm_level


@pytest.mark.smoke
def test_audio_config():
    """Verify audio frame byte calculations for 16kHz 16-bit mono."""
    cfg = AudioConfig(sample_rate=16000, chunk_duration_ms=100, bytes_per_sample=2)
    # 16000 * 0.1 * 2 = 3200 bytes per 100ms chunk
    assert cfg.chunk_size_bytes == 3200


@pytest.mark.smoke
def test_calculate_pcm_level():
    """Verify RMS calculation produces zero on silence and positive on audio."""
    silence = b"\x00\x00" * 1600
    assert calculate_pcm_level(silence) == 0.0

    # Max volume square wave
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
    assert data["transcribe_model"] == "gemini-3.5-transcribe-live-preview"
    assert data["translation_model"] == "gemini-3.5-flash"
    assert data["location"] == "global"

    # 2. Config get
    resp = client.get("/api/config")
    assert resp.status_code == 200
    config_data = resp.json()
    assert config_data["transcribe_model"] == "gemini-3.5-transcribe-live-preview"
    assert config_data["translation_model"] == "gemini-3.5-flash"
    assert "wedding" in config_data

    # 3. Export empty transcript
    resp = client.get("/api/transcript/export?format=markdown")
    assert resp.status_code == 200
    assert "Wedding Speech Transcript" in resp.text

    # 4. Clear transcript
    resp = client.post("/api/transcript/clear")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cleared"


@pytest.mark.asyncio
async def test_gemini_live_session_lifecycle():
    """Verify live bidirectional session establishment and audio push with GeminiLiveTranslator."""
    import asyncio

    audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
    translator = GeminiLiveTranslator()

    events = []

    async def run_session():
        async for event in translator.start_session(audio_input_queue=audio_queue):
            events.append(event)
            if (
                event.get("type") == "session_status"
                and event.get("status") == "connected"
            ):
                # Feed 100ms silence PCM
                await audio_queue.put(b"\x00\x00" * 1600)
                await asyncio.sleep(0.5)
                break

    await asyncio.wait_for(run_session(), timeout=10.0)
    assert any(
        e.get("type") == "session_status" and e.get("status") == "connected"
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
    """Verify that frontend pages (/ , /projector, /speaker, /mobile) serve correctly."""
    client = TestClient(app)

    for route in ["/", "/projector", "/speaker", "/mobile"]:
        resp = client.get(route)
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        # When dist is built, it serves index.html with the root div
        assert '<div id="root">' in resp.text or "Wedding Translator" in resp.text

    # /test should still serve raw microphone testing console
    resp_test = client.get("/test")
    assert resp_test.status_code == 200
    assert "Wedding Speech Translator" in resp_test.text


def test_two_step_configuration():
    """Verify two-step pipeline settings and defaults."""
    assert settings.transcribe_model == "gemini-3.5-transcribe-live-preview"
    assert settings.translation_model == "gemini-3.5-flash"
    assert settings.translation_thinking_budget == 0


def test_create_translator():
    """Verify translator engine instantiates with correct models."""
    translator = create_translator()
    assert isinstance(translator, GeminiLiveTranslator)
    assert translator.transcribe_model == "gemini-3.5-transcribe-live-preview"
    assert translator.translation_model == "gemini-3.5-flash"
