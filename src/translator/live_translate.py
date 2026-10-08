"""Real-time Chinese-to-English speech translation with the Gemini Live Translate model.

Follows Google's reference client (google-gemini/gemini-live-api-examples,
command-line/python/translate.py): the session is a continuous interpreter, not a
turn-based assistant. 100 ms PCM chunks go in; the source transcript and the
translated transcript stream out. The only app logic on top is pairing the two
transcripts into sentence subtitles (SubtitleSegmenter).
"""

import asyncio
import base64
import logging
import re
import time
from collections.abc import AsyncGenerator
from typing import Any, NotRequired, TypedDict

from google import genai
from google.genai import types
from opencc import OpenCC

from translator.config import settings

logger = logging.getLogger("wedding_translator.live_translate")

# The model transcribes Mandarin in Traditional characters; the subtitles show Simplified.
TO_SIMPLIFIED = OpenCC("t2s")

INPUT_SAMPLE_RATE = 16000
OUTPUT_SAMPLE_RATE = 24000
# 100 ms of 16-bit mono PCM, the chunk size the Live Translate docs recommend.
CHUNK_BYTES = INPUT_SAMPLE_RATE // 10 * 2

ENGLISH_SENTENCE_END = re.compile(r"[.!?]+[\"')\]]*(?=\s|$)")
CHINESE_SENTENCE_ENDINGS = "。！？!?"
# English finished a sentence but its Chinese never reached a sentence end: commit anyway.
PAIRING_TIMEOUT_SECONDS = 1.5
# Speaker paused mid-sentence: commit whatever has been translated.
SILENCE_FLUSH_SECONDS = 2.5
# After the mic stops, how long the trailing translation is given to arrive.
DRAIN_SECONDS = 3.0
# A session the server closes sooner than this is treated as a failure, not rotation.
MIN_HEALTHY_SESSION_SECONDS = 5.0


class LiveEvent(TypedDict):
    """Typed dictionary representing events emitted during a live translation session."""

    type: str
    status: NotRequired[str]
    id: NotRequired[int]
    chinese: NotRequired[str]
    english: NotRequired[str]
    timestamp: NotRequired[str]
    model: NotRequired[str]
    use_vertex: NotRequired[bool]
    error: NotRequired[str]
    data: NotRequired[str]
    sample_rate: NotRequired[int]


def create_genai_client(
    use_vertex: bool,
    project_id: str | None = None,
    location: str | None = None,
    api_key: str | None = None,
) -> genai.Client:
    """Instantiate a Google GenAI Client configured for Vertex AI or Google AI Studio.

    Args:
        use_vertex: True to route through Google Cloud Vertex AI; False for AI Studio.
        project_id: Google Cloud project ID (required when use_vertex=True).
        location: Google Cloud region (e.g. 'global' or 'australia-southeast2').
        api_key: API key for Google AI Studio (required when use_vertex=False).

    Returns:
        Configured genai.Client instance.
    """
    if use_vertex:
        # Passed through as-is: gemini-3.5-live-translate-preview is served from 'global'
        # (us-central1 returns 1011 Resource exhausted for it).
        logger.info(
            "Initializing Google GenAI Client with Vertex AI (project=%s, location=%s)",
            project_id,
            location,
        )
        return genai.Client(
            vertexai=True,
            project=project_id,
            location=location,
        )

    logger.info("Initializing Google GenAI Client with Google AI Studio")
    return genai.Client(
        vertexai=False,
        api_key=api_key or None,
    )


def build_live_connect_config(target_language_code: str) -> types.LiveConnectConfig:
    """Google's reference Live Translate config, unchanged."""
    return types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        translation_config=types.TranslationConfig(
            target_language_code=target_language_code,
            echo_target_language=settings.echo_target_language,
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )


class SubtitleSegmenter:
    """Pairs the streamed Chinese transcript with its English translation, one subtitle per sentence.

    Both transcripts stream continuously and either one can run ahead of the other
    (the Chinese "…睡" / "觉。" can arrive after the English "…in the library."). A
    subtitle is therefore committed only once the English has finished a sentence
    *and* the Chinese has reached a sentence end; the Chinese is cut after as many
    sentence ends as the English contains, and the rest carries to the next subtitle.
    """

    def __init__(self, first_id: int = 1) -> None:
        self.next_id = first_id
        self.chinese = ""
        self.english = ""
        self.english_done_at: float | None = None
        self.last_activity = 0.0

    def add_chinese(self, text: str, now: float) -> list[LiveEvent]:
        self.chinese += text
        self.last_activity = now
        return [self._partial(), *self._commit_if_paired()]

    def add_english(self, text: str, now: float) -> list[LiveEvent]:
        self.english += text
        self.last_activity = now
        if self.english_done_at is None and ENGLISH_SENTENCE_END.search(self.english):
            self.english_done_at = now
        return [self._partial(), *self._commit_if_paired()]

    def tick(self, now: float) -> list[LiveEvent]:
        """Commit on timeouts: finished English whose Chinese never paired, or a pause mid-sentence."""
        if not self.english.strip():
            return []
        if now - self.last_activity >= SILENCE_FLUSH_SECONDS:
            return [self._commit(whole=True)]
        if (
            self.english_done_at is not None
            and now - self.english_done_at >= PAIRING_TIMEOUT_SECONDS
        ):
            return [self._commit()]
        return []

    def flush(self) -> list[LiveEvent]:
        """Commit everything pending (stream ended)."""
        if not (self.english.strip() or self.chinese.strip()):
            return []
        return [self._commit(whole=True)]

    def _commit_if_paired(self) -> list[LiveEvent]:
        if self.english_done_at is not None and self._chinese_sentence_ends():
            return [self._commit()]
        return []

    def _chinese_sentence_ends(self) -> list[int]:
        return [
            i for i, ch in enumerate(self.chinese) if ch in CHINESE_SENTENCE_ENDINGS
        ]

    def _commit(self, whole: bool = False) -> LiveEvent:
        """Commit up to the last English sentence end (or everything when whole=True)."""
        sentence_ends = list(ENGLISH_SENTENCE_END.finditer(self.english))
        if sentence_ends and not whole:
            cut = sentence_ends[-1].end()
            english, self.english = self.english[:cut], self.english[cut:]
        else:
            english, self.english = self.english, ""

        chinese_ends = self._chinese_sentence_ends()
        if sentence_ends and chinese_ends and not whole:
            n = min(len(sentence_ends), len(chinese_ends))
            cut = chinese_ends[n - 1] + 1
            chinese, self.chinese = self.chinese[:cut], self.chinese[cut:]
        else:
            chinese, self.chinese = self.chinese, ""

        event: LiveEvent = {
            "type": "final",
            "id": self.next_id,
            "chinese": chinese.strip(),
            "english": english.strip(),
            "timestamp": time.strftime("%H:%M:%S"),
        }
        logger.info(
            "Subtitle #%d: [ZH] %s -> [EN] %s",
            event["id"],
            event["chinese"],
            event["english"],
        )
        self.next_id += 1
        self.english_done_at = None
        return event

    def _partial(self) -> LiveEvent:
        return {
            "type": "partial",
            "id": self.next_id,
            "chinese": self.chinese.strip(),
            "english": self.english.strip(),
        }


class GeminiLiveTranslator:
    """Streams speaker audio through Gemini Live Translate and yields subtitle events.

    Attributes:
        live_model: Gemini Live model identifier (e.g. 'gemini-3.5-live-translate-preview').
        use_vertex: Boolean indicating whether Vertex AI or AI Studio backend is used.
        client: Authenticated Google GenAI SDK client.
    """

    def __init__(
        self,
        live_model: str | None = None,
        target_language_code: str | None = None,
        project_id: str | None = None,
        location: str | None = None,
        api_key: str | None = None,
        use_vertex: bool | None = None,
    ) -> None:
        self.live_model = live_model or settings.live_model
        self.target_language_code = target_language_code or settings.target_language
        self.project_id = project_id or settings.google_cloud_project
        self.location = location or settings.google_cloud_location
        self.api_key = api_key or settings.gemini_api_key
        self.use_vertex = settings.use_vertex if use_vertex is None else use_vertex

        self.client = create_genai_client(
            use_vertex=self.use_vertex,
            project_id=self.project_id,
            location=self.location,
            api_key=self.api_key,
        )

    async def start_session(
        self,
        audio_input_queue: asyncio.Queue[bytes | None],
        first_subtitle_id: int = 1,
    ) -> AsyncGenerator[LiveEvent]:
        """Translate 16 kHz PCM from the queue until it yields None (mic stopped).

        Subtitle ids start at first_subtitle_id so a new mic session continues the
        transcript instead of reusing (and on screen, replacing) earlier ids.

        Yields:
            LiveEvent dictionaries (session_status, partial, final, audio, error).
        """
        events: asyncio.Queue[LiveEvent | None] = asyncio.Queue()
        runner = asyncio.create_task(
            self._run(audio_input_queue, events, first_subtitle_id)
        )
        try:
            while (event := await events.get()) is not None:
                yield event
        finally:
            runner.cancel()
            await asyncio.gather(runner, return_exceptions=True)
            logger.info("Gemini Live translation session closed")

    async def _run(
        self,
        audio_queue: asyncio.Queue[bytes | None],
        events: asyncio.Queue[LiveEvent | None],
        first_subtitle_id: int,
    ) -> None:
        segmenter = SubtitleSegmenter(first_subtitle_id)
        config = build_live_connect_config(self.target_language_code)
        try:
            mic_open = True
            while mic_open:
                logger.info(
                    "Connecting to Gemini Live (%s) via %s...",
                    self.live_model,
                    f"Vertex AI ({self.location})" if self.use_vertex else "AI Studio",
                )
                async with self.client.aio.live.connect(
                    model=self.live_model, config=config
                ) as session:
                    await events.put(
                        {
                            "type": "session_status",
                            "status": "connected",
                            "model": self.live_model,
                            "use_vertex": self.use_vertex,
                        }
                    )
                    mic_open = await self._stream(
                        session, audio_queue, segmenter, events
                    )
                # The server ended the session (time limit or GoAway) while the speaker is
                # still talking: start a fresh one. Pending text belongs to the old session.
                for event in segmenter.flush():
                    await events.put(event)
                if mic_open:
                    logger.info("Gemini Live session ended; reconnecting")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Gemini Live session failure")
            for event in segmenter.flush():
                await events.put(event)
            await events.put(
                {
                    "type": "error",
                    "error": str(exc),
                    "timestamp": time.strftime("%H:%M:%S"),
                }
            )
        else:
            await events.put({"type": "session_status", "status": "disconnected"})
        finally:
            await events.put(None)

    async def _stream(
        self,
        session: Any,
        audio_queue: asyncio.Queue[bytes | None],
        segmenter: SubtitleSegmenter,
        events: asyncio.Queue[LiveEvent | None],
    ) -> bool:
        """Run one Live session. Returns True if the server ended it, False if the mic stopped."""
        started = time.monotonic()

        async def send_audio() -> None:
            buffer = b""
            while (pcm := await audio_queue.get()) is not None:
                buffer += pcm
                while len(buffer) >= CHUNK_BYTES:
                    chunk, buffer = buffer[:CHUNK_BYTES], buffer[CHUNK_BYTES:]
                    await self._send_chunk(session, chunk)
            if buffer:
                await self._send_chunk(session, buffer)
            logger.info("Microphone stopped: sending audio_stream_end")
            await session.send_realtime_input(audio_stream_end=True)
            await asyncio.sleep(DRAIN_SECONDS)

        async def receive() -> None:
            while True:
                async for message in session.receive():
                    if message.go_away:
                        logger.warning(
                            "Gemini Live GoAway (time_left=%s)",
                            message.go_away.time_left,
                        )
                        return
                    for event in self._handle_message(message, segmenter):
                        await events.put(event)

        async def tick() -> None:
            while True:
                await asyncio.sleep(0.25)
                for event in segmenter.tick(time.monotonic()):
                    await events.put(event)

        sender = asyncio.create_task(send_audio())
        receiver = asyncio.create_task(receive())
        ticker = asyncio.create_task(tick())
        try:
            done, _ = await asyncio.wait(
                {sender, receiver}, return_when=asyncio.FIRST_COMPLETED
            )
        finally:
            for task in (sender, receiver, ticker):
                task.cancel()
            await asyncio.gather(sender, receiver, ticker, return_exceptions=True)

        if sender in done and sender.exception() is None:
            return False
        # The session ended under us (GoAway, time limit, dropped socket): rotate to a
        # fresh one, unless it died right after connecting (auth, quota or config error).
        ended = sender if sender in done else receiver
        if time.monotonic() - started < MIN_HEALTHY_SESSION_SECONDS:
            ended.result()
            raise RuntimeError(
                "Gemini Live session closed immediately after connecting"
            )
        if ended.exception():
            logger.warning("Gemini Live session dropped: %s", ended.exception())
        return True

    async def _send_chunk(self, session: Any, chunk: bytes) -> None:
        await session.send_realtime_input(
            audio=types.Blob(
                data=chunk, mime_type=f"audio/pcm;rate={INPUT_SAMPLE_RATE}"
            )
        )

    def _handle_message(
        self, message: types.LiveServerMessage, segmenter: SubtitleSegmenter
    ) -> list[LiveEvent]:
        content = message.server_content
        if not content:
            return []
        now = time.monotonic()
        events: list[LiveEvent] = []

        if content.input_transcription and content.input_transcription.text:
            events += segmenter.add_chinese(
                TO_SIMPLIFIED.convert(content.input_transcription.text), now
            )

        if content.model_turn:
            for part in content.model_turn.parts or []:
                if (
                    part.inline_data
                    and part.inline_data.data
                    and settings.enable_audio_broadcast
                ):
                    events.append(
                        {
                            "type": "audio",
                            "data": base64.b64encode(part.inline_data.data).decode(
                                "ascii"
                            ),
                            "sample_rate": OUTPUT_SAMPLE_RATE,
                        }
                    )
                # Text parts are service notices (e.g. "Quota exceeded"), not translation.
                if part.text:
                    logger.warning("Gemini Live text part: %s", part.text)

        if content.output_transcription and content.output_transcription.text:
            events += segmenter.add_english(content.output_transcription.text, now)

        return events


def create_translator(**kwargs: Any) -> GeminiLiveTranslator:
    """Factory function to instantiate GeminiLiveTranslator."""
    return GeminiLiveTranslator(**kwargs)
