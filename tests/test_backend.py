"""Comprehensive unit and integration test suite for the Wedding Translator."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from google.genai import types

from translator.config import (
    AudioConfig,
    Settings,
    settings,
)
from translator.live_translate import (
    CHUNK_BYTES,
    SILENCE_FLUSH_SECONDS,
    GeminiLiveTranslator,
    SubtitleSegmenter,
    TranslationRefiner,
    build_live_connect_config,
    create_translator,
)
from translator.server import (
    BroadcastHub,
    SessionManager,
    SubtitleRecord,
    app,
    calculate_pcm_level,
    pcm_dbfs,
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


def test_level_meter_reads_normal_speech_on_a_db_scale():
    """Speech around -20 dBFS fills two thirds of the meter instead of a 10% sliver."""
    import math
    import struct

    amplitude = 32768 * 10 ** (-20 / 20)  # RMS of a constant signal = its amplitude
    pcm = struct.pack("<1600h", *[int(amplitude)] * 1600)
    rms_db, peak_db = pcm_dbfs(pcm)
    assert math.isclose(rms_db, -20, abs_tol=0.1)
    assert math.isclose(peak_db, -20, abs_tol=0.1)
    assert 66 <= calculate_pcm_level(pcm) <= 67


@pytest.mark.smoke
def test_api_health_and_config():
    """Verify REST endpoints for health check, config retrieval, and export."""
    client = TestClient(app)

    # 1. Health check
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["live_model"] == "gemini-3.5-live-translate-preview"
    assert isinstance(data["use_vertex"], bool)
    assert data["location"] == settings.google_cloud_location

    # 2. Config get
    resp = client.get("/api/config")
    assert resp.status_code == 200
    config_data = resp.json()
    assert config_data["live_model"] == "gemini-3.5-live-translate-preview"
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
    """Verify the live-translate model is configured."""
    assert settings.live_model == "gemini-3.5-live-translate-preview"


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
    """Verify translator engine instantiates with the live-translate model."""
    translator = create_translator()
    assert isinstance(translator, GeminiLiveTranslator)
    assert translator.live_model == "gemini-3.5-live-translate-preview"


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


def test_speaker_session_released_when_translator_init_fails(monkeypatch):
    """A Gemini client init failure must not leave the speaker lock held (would 4409 every later speaker)."""
    from starlette.websockets import WebSocketDisconnect

    from translator.server import session_manager

    monkeypatch.setattr(settings, "google_oauth_client_id", "client-id.apps.googleusercontent.com")
    monkeypatch.setattr("translator.server.verify_speaker_identity", lambda token: "approved@example.com")
    monkeypatch.setattr("translator.server.GeminiLiveTranslator", MagicMock(side_effect=ValueError("No API key")))
    client = TestClient(app)
    with client.websocket_connect("/ws/speaker?id_token=t") as ws:
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_text()
    assert exc.value.code == 1011
    assert session_manager.is_active is False


def test_live_config_matches_google_reference():
    """The session config is Google's reference one: no prompt, vocabulary, VAD or context settings."""
    cfg = build_live_connect_config("en")
    assert cfg.translation_config.target_language_code == "en"
    assert cfg.input_audio_transcription == types.AudioTranscriptionConfig()
    assert cfg.output_audio_transcription is not None
    assert cfg.system_instruction is None
    assert cfg.context_window_compression is None
    assert cfg.session_resumption is None
    assert cfg.realtime_input_config is None


def _commits(events):
    return [(e["chinese"], e["english"]) for e in events if e["type"] == "final"]


def test_segmenter_cuts_at_sentence_ends_and_at_commas_in_long_clauses():
    """A sentence end always cuts; a comma cuts only once the subtitle is long enough to read."""
    seg = SubtitleSegmenter()
    out = seg.add_chinese("大家好,", 0.0)
    assert _commits(out) == []
    out = seg.add_chinese(
        "我是新郎的表哥。说实话,我从小看着他长大,他小时候特别调皮,上树", 0.5
    )
    assert _commits(out) == [
        ("大家好,我是新郎的表哥。", ""),
        ("说实话,我从小看着他长大,他小时候特别调皮,", ""),
    ]
    assert seg.chinese == "上树"
    assert out[-1] == {"type": "partial", "id": 3, "chinese": "上树", "english": ""}


def test_segmenter_live_english_is_a_draft_on_the_open_subtitle():
    """The lagging live English shows on the open subtitle and goes with it at the cut."""
    seg = SubtitleSegmenter()
    seg.add_chinese("他紧张得", 0.0)
    out = seg.add_english("He was so nervous", 0.2)
    assert out == [
        {
            "type": "partial",
            "id": 1,
            "chinese": "他紧张得",
            "english": "He was so nervous",
        }
    ]
    out = seg.add_chinese("连戒指都差点掉了。", 0.4)
    assert _commits(out) == [("他紧张得连戒指都差点掉了。", "He was so nervous")]
    assert seg.english == ""


def test_segmenter_flushes_on_silence_and_drops_trailing_draft():
    seg = SubtitleSegmenter()
    seg.add_chinese("他紧张得", 10.0)
    assert seg.tick(10.0 + SILENCE_FLUSH_SECONDS / 2) == []
    assert _commits(seg.tick(10.0 + SILENCE_FLUSH_SECONDS)) == [("他紧张得", "")]
    # English of the last subtitle arriving after the cut is not carried forward.
    seg.add_english("He was so nervous", 13.0)
    assert seg.tick(20.0) == []
    assert seg.english == ""
    seg.add_english(" Cheers.", 21.0)
    assert seg.flush() == []


def _refiner(monkeypatch, generate):
    monkeypatch.setattr(TranslationRefiner, "_generate", generate)
    return TranslationRefiner(client=MagicMock(), model="primary")


@pytest.mark.asyncio
async def test_refiner_gives_context_and_names(monkeypatch):
    prompts = []

    async def generate(self, prompt, model, thinking):
        prompts.append(prompt)
        return f"EN{len(prompts)}"

    refiner = _refiner(monkeypatch, generate)
    assert await refiner.refine("大家好,", "draft") == "EN1"
    assert await refiner.refine("我是新郎的表哥。", "") == "EN2"
    assert settings.wedding.groom_name in prompts[0]
    assert "Chinese: 大家好,\nEnglish: EN1" in prompts[1]
    assert prompts[1].endswith("Chinese: 我是新郎的表哥。")
    assert await refiner.refine("", "draft") is None


@pytest.mark.asyncio
async def test_refiner_races_a_backup_when_the_first_request_stalls(monkeypatch):
    """A stalled request is raced by a later one (on the backup model) instead of timing out."""
    monkeypatch.setattr("translator.live_translate.REFINE_TIMEOUT_SECONDS", 1.0)
    calls = []

    async def generate(self, prompt, model, thinking):
        calls.append(model)
        if model == "primary":
            await asyncio.Event().wait()
        return "Cheers!"

    monkeypatch.setattr("translator.live_translate.REFINE_STAGGER_SECONDS", 0.05)
    refiner = _refiner(monkeypatch, generate)
    assert await refiner.refine("干杯。", "draft") == "Cheers!"
    assert calls[0] == "primary" and calls[1] != "primary"


@pytest.mark.asyncio
async def test_refiner_gives_up_when_every_request_fails(monkeypatch):
    async def generate(self, prompt, model, thinking):
        raise RuntimeError("429 RESOURCE_EXHAUSTED")

    monkeypatch.setattr("translator.live_translate.REFINE_TIMEOUT_SECONDS", 0.2)
    monkeypatch.setattr("translator.live_translate.REFINE_STAGGER_SECONDS", 0.01)
    refiner = _refiner(monkeypatch, generate)
    assert await refiner.refine("干杯。", "Cheers.") is None
    assert refiner.history == [("干杯。", "Cheers.")]


async def _fake_refine(self, prompt, model, thinking):
    return "EN(" + prompt.rsplit("Chinese: ", 1)[-1] + ")"


def _subtitles(events):
    """What each subtitle ends up showing: later finals for an id replace earlier ones."""
    cards = {}
    for e in events:
        if e["type"] == "final":
            cards[e["id"]] = (e["chinese"], e["english"])
    return list(cards.values())


def _message(input_text=None, output_text=None, text_part=None, go_away=None):
    """Build a mock LiveServerMessage."""
    msg = MagicMock()
    msg.go_away = go_away
    sc = msg.server_content
    sc.input_transcription = MagicMock(text=input_text) if input_text else None
    sc.output_transcription = MagicMock(text=output_text) if output_text else None
    sc.model_turn = (
        MagicMock(parts=[MagicMock(text=text_part, inline_data=None)])
        if text_part
        else None
    )
    return msg


def _mock_connect(*sessions):
    """Patchable stand-in for client.aio.live.connect yielding the given sessions in order."""
    sessions = iter(sessions)

    class Ctx:
        async def __aenter__(self):
            return next(sessions)

        async def __aexit__(self, *exc):
            return None

    return MagicMock(side_effect=lambda **kwargs: Ctx())


def _mock_session(messages):
    session = MagicMock()
    session.send_realtime_input = AsyncMock()

    async def receive():
        for m in messages:
            yield m
        messages.clear()
        await asyncio.Event().wait()

    session.receive = receive
    return session


@pytest.mark.asyncio
async def test_session_streams_100ms_chunks_and_drains_after_mic_stop(monkeypatch):
    """Audio is re-chunked to 100 ms, mic stop sends audio_stream_end, and the last subtitle is flushed."""
    monkeypatch.setattr("translator.live_translate.DRAIN_SECONDS", 0.05)
    monkeypatch.setattr(TranslationRefiner, "_generate", _fake_refine)
    translator = GeminiLiveTranslator()
    session = _mock_session(
        [
            _message(text_part="Quota exceeded. Please retry later."),
            _message(input_text="大家晚上好。"),
            _message(output_text="Good evening, everyone."),
            _message(input_text="謝謝"),
            _message(output_text=" Thank you"),
        ]
    )
    audio: asyncio.Queue[bytes | None] = asyncio.Queue()
    for _ in range(5):
        await audio.put(b"\x01\x00" * 1024)  # 2048-byte browser frames
    await audio.put(None)

    with patch.object(translator.client.aio.live, "connect", _mock_connect(session)):
        events = [e async for e in translator.start_session(audio_input_queue=audio)]

    sends = [c.kwargs for c in session.send_realtime_input.await_args_list]
    sizes = [len(s["audio"].data) for s in sends if "audio" in s]
    assert sizes == [CHUNK_BYTES] * 3 + [10240 - 3 * CHUNK_BYTES]
    assert sends[-1] == {"audio_stream_end": True}
    # Each subtitle appears with its Chinese first, then its refined English.
    assert _commits(events) == [
        ("大家晚上好。", ""),
        ("大家晚上好。", "EN(大家晚上好。)"),
        ("谢谢", ""),
        ("谢谢", "EN(谢谢)"),
    ]
    assert events[0]["status"] == "connected"
    assert events[-1] == {"type": "session_status", "status": "disconnected"}


@pytest.mark.asyncio
async def test_session_reconnects_fresh_after_go_away(monkeypatch):
    """A GoAway rotates to a new session instead of ending the speaker's stream."""
    monkeypatch.setattr("translator.live_translate.MIN_HEALTHY_SESSION_SECONDS", 0)
    monkeypatch.setattr("translator.live_translate.DRAIN_SECONDS", 0.05)
    monkeypatch.setattr(TranslationRefiner, "_generate", _fake_refine)
    translator = GeminiLiveTranslator()
    first = _mock_session(
        [
            _message(input_text="大家好。"),
            _message(output_text="Hello everyone."),
            _message(go_away=MagicMock(time_left="5s")),
        ]
    )
    second = _mock_session(
        [_message(input_text="干杯。"), _message(output_text="Cheers.")]
    )
    audio: asyncio.Queue[bytes | None] = asyncio.Queue()
    connect = _mock_connect(first, second)

    async def stop_mic_when_second_session_opens():
        while connect.call_count < 2:
            await asyncio.sleep(0.01)
        await asyncio.sleep(0.05)
        await audio.put(None)

    stopper = asyncio.create_task(stop_mic_when_second_session_opens())
    with patch.object(translator.client.aio.live, "connect", connect):
        events = await asyncio.wait_for(
            _collect(translator.start_session(audio_input_queue=audio)), timeout=5
        )
    await stopper

    assert connect.call_count == 2
    assert [e["status"] for e in events if e["type"] == "session_status"] == [
        "connected",
        "connected",
        "disconnected",
    ]
    assert _subtitles(events) == [
        ("大家好。", "EN(大家好。)"),
        ("干杯。", "EN(干杯。)"),
    ]


async def _collect(agen):
    return [e async for e in agen]


@pytest.mark.asyncio
async def test_session_reconnects_when_send_fails(monkeypatch):
    """A socket that drops while sending audio rotates to a new session; the mic stream continues."""
    monkeypatch.setattr("translator.live_translate.MIN_HEALTHY_SESSION_SECONDS", 0)
    monkeypatch.setattr("translator.live_translate.DRAIN_SECONDS", 0.05)
    translator = GeminiLiveTranslator()
    first = _mock_session([])
    first.send_realtime_input = AsyncMock(side_effect=ConnectionError("socket closed"))
    second = _mock_session([])
    audio: asyncio.Queue[bytes | None] = asyncio.Queue()
    await audio.put(bytes(CHUNK_BYTES))
    await audio.put(bytes(CHUNK_BYTES))
    await audio.put(None)

    with patch.object(
        translator.client.aio.live, "connect", _mock_connect(first, second)
    ):
        events = await asyncio.wait_for(
            _collect(translator.start_session(audio_input_queue=audio)), timeout=5
        )

    sends = [c.kwargs for c in second.send_realtime_input.await_args_list]
    assert len(sends[0]["audio"].data) == CHUNK_BYTES
    assert sends[-1] == {"audio_stream_end": True}
    assert events[-1] == {"type": "session_status", "status": "disconnected"}


@pytest.mark.asyncio
async def test_new_mic_session_continues_subtitle_ids(monkeypatch):
    """Restarting the mic must not reuse ids: the UI replaces a card that has the same id."""
    monkeypatch.setattr("translator.live_translate.DRAIN_SECONDS", 0.05)
    sm = SessionManager()
    assert sm.next_subtitle_id() == 1
    for i in (1, 2):
        sm.add_record(SubtitleRecord(id=i, chinese="", english="", timestamp=""))

    monkeypatch.setattr(TranslationRefiner, "_generate", _fake_refine)
    translator = GeminiLiveTranslator()
    session = _mock_session(
        [_message(input_text="干杯。"), _message(output_text="Cheers.")]
    )
    audio: asyncio.Queue[bytes | None] = asyncio.Queue()
    finals = []
    with patch.object(translator.client.aio.live, "connect", _mock_connect(session)):
        async for event in translator.start_session(
            audio_input_queue=audio, first_subtitle_id=sm.next_subtitle_id()
        ):
            if event["type"] == "final":
                finals.append(event)
                await audio.put(None)

    assert {f["id"] for f in finals} == {3}


@pytest.mark.asyncio
async def test_session_keeps_live_english_when_refinement_is_off(monkeypatch):
    monkeypatch.setattr("translator.live_translate.DRAIN_SECONDS", 0.05)
    translator = GeminiLiveTranslator()
    translator.refine_model = ""
    session = _mock_session(
        [_message(input_text="他紧张得"), _message(output_text="He was so nervous")]
    )
    audio: asyncio.Queue[bytes | None] = asyncio.Queue()
    await audio.put(None)
    with patch.object(translator.client.aio.live, "connect", _mock_connect(session)):
        events = [e async for e in translator.start_session(audio_input_queue=audio)]
    assert _commits(events) == [("他紧张得", "He was so nervous")]


def test_history_replaces_a_refined_subtitle():
    sm = SessionManager()
    sm.add_record(SubtitleRecord(id=1, chinese="干杯。", english="", timestamp=""))
    sm.add_record(
        SubtitleRecord(id=1, chinese="干杯。", english="Cheers!", timestamp="")
    )
    assert [(r.id, r.english) for r in sm.history] == [(1, "Cheers!")]
