"""Real-time Chinese-to-English speech translation with the Gemini Live Translate model.

Follows Google's reference client (google-gemini/gemini-live-api-examples,
command-line/python/translate.py): the session is a continuous interpreter, not a
turn-based assistant. 100 ms PCM chunks go in; the source transcript, the
translated transcript and translated audio stream out.

On top of that, the app cuts the Chinese transcript into short subtitles
(SubtitleSegmenter) and, once each is complete, replaces the Live model's
on-the-fly English with a context-aware text translation (TranslationRefiner).
"""

import asyncio
import base64
import logging
import time
from collections.abc import AsyncGenerator, Awaitable, Callable
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

CHINESE_SENTENCE_ENDINGS = "。！？!?"
CHINESE_CLAUSE_BREAKS = "，,；;"
# A comma ends a subtitle only once it holds this many characters (~4 s of speech).
MIN_CLAUSE_CHARS = 18
# Speaker paused mid-clause: commit what has been transcribed.
SILENCE_FLUSH_SECONDS = 2.5
# Previous subtitles the text model sees, so a clause reads on from the last one.
REFINE_CONTEXT_SUBTITLES = 4
# Requests occasionally stall for 10 s+; every this many seconds another one is raced.
REFINE_STAGGER_SECONDS = 2.0
# The second raced request goes to another model.
REFINE_BACKUP_MODEL = "gemini-3.8-flash"
# Past this the subtitle keeps the Live model's English.
REFINE_TIMEOUT_SECONDS = 8.0
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
    """Cuts the streamed Chinese transcript into short subtitles.

    The Chinese transcript is what the subtitles are built on: a subtitle ends at a
    sentence end, or at a comma once it is long enough to read (the model often
    chains a whole paragraph with commas). The live English rides along as a draft
    that TranslationRefiner later replaces; it lags the Chinese, so it is never used
    to decide where a subtitle ends.
    """

    def __init__(self, first_id: int = 1) -> None:
        self.next_id = first_id
        self.chinese = ""
        self.english = ""
        self.last_chinese_at = 0.0

    def add_chinese(self, text: str, now: float) -> list[LiveEvent]:
        self.chinese += text
        self.last_chinese_at = now
        events: list[LiveEvent] = []
        while (cut := self._clause_end()) is not None:
            events.append(self._commit(cut))
        return [*events, self._partial()]

    def add_english(self, text: str, now: float) -> list[LiveEvent]:
        self.english += text
        return [self._partial()]

    def tick(self, now: float) -> list[LiveEvent]:
        """Commit a half-finished clause once the speaker pauses."""
        if now - self.last_chinese_at < SILENCE_FLUSH_SECONDS:
            return []
        if self.chinese.strip():
            return [self._commit(len(self.chinese))]
        # Draft English that trailed the last subtitle: drop it, not carry it forward.
        self.english = ""
        return []

    def flush(self) -> list[LiveEvent]:
        """Commit the unfinished clause (stream ended); trailing draft English alone is dropped."""
        if not self.chinese.strip():
            self.english = ""
            return []
        return [self._commit(len(self.chinese))]

    def _clause_end(self) -> int | None:
        for i, ch in enumerate(self.chinese):
            if ch in CHINESE_SENTENCE_ENDINGS or (
                ch in CHINESE_CLAUSE_BREAKS and i + 1 >= MIN_CLAUSE_CHARS
            ):
                return i + 1
        return None

    def _commit(self, cut: int) -> LiveEvent:
        chinese, self.chinese = self.chinese[:cut], self.chinese[cut:]
        english, self.english = self.english, ""
        event: LiveEvent = {
            "type": "final",
            "id": self.next_id,
            "chinese": chinese.strip(),
            "english": english.strip(),
            "timestamp": time.strftime("%H:%M:%S"),
        }
        self.next_id += 1
        return event

    def _partial(self) -> LiveEvent:
        return {
            "type": "partial",
            "id": self.next_id,
            "chinese": self.chinese.strip(),
            "english": self.english.strip(),
        }


class TranslationRefiner:
    """Re-translates each finished Chinese subtitle with a text model.

    The Live model interprets on the fly: it commits to English before the Chinese
    sentence is over and only knows the names it hears. Once a clause is complete,
    a text model given the preceding subtitles and the wedding's names turns it into
    English that reads as one continuous speech.
    """

    def __init__(self, client: genai.Client, model: str) -> None:
        self.client = client
        self.model = model
        self.history: list[tuple[str, str]] = []
        wedding = settings.wedding
        self.context = (
            "Live English subtitles for a wedding speech given in Mandarin Chinese, sometimes "
            f"mixed with English. The bride is {wedding.bride_name}, the groom is "
            f"{wedding.groom_name}, the venue is {wedding.venue}."
            + (f" Speaker: {wedding.speaker_role}." if wedding.speaker_role else "")
            + (f" {wedding.custom_notes}" if wedding.custom_notes else "")
            + " The Chinese is an automatic speech transcript, so names and words may be "
            "misheard as similar-sounding ones (新郎 'groom' as 星朗, the couple's names as "
            "other characters); translate what the speaker meant."
        )

    async def refine(self, chinese: str, draft: str) -> str | None:
        """English for the subtitle, or None if the text model did not answer in time."""
        if not chinese:
            return None
        previous = "\n".join(
            f"Chinese: {zh}\nEnglish: {en}"
            for zh, en in self.history[-REFINE_CONTEXT_SUBTITLES:]
        )
        prompt = (
            f"{self.context}\n\nPrevious subtitles:\n{previous or '(start of speech)'}\n\n"
            "Translate only the next subtitle into natural English. It may be part of a longer "
            "sentence; continue smoothly from the previous subtitle. Output only the English.\n\n"
            f"Chinese: {chinese}"
        )
        english = await self._generate_hedged(prompt)
        self.history.append((chinese, english or draft))
        return english

    async def _generate_hedged(self, prompt: str) -> str | None:
        """Race staggered requests and take the first answer.

        Text models occasionally stall for 10 s or more; a request started a couple of
        seconds later (first on a second model) almost always answers before it.
        """
        attempts = [
            (0.0, self.model, types.ThinkingConfig(thinking_budget=0)),
            (
                REFINE_STAGGER_SECONDS,
                REFINE_BACKUP_MODEL,
                types.ThinkingConfig(thinking_level="low"),
            ),
            (
                2 * REFINE_STAGGER_SECONDS,
                self.model,
                types.ThinkingConfig(thinking_budget=0),
            ),
        ]
        pending: set[asyncio.Task[str]] = set()
        started = time.monotonic()
        try:
            while (elapsed := time.monotonic() - started) < REFINE_TIMEOUT_SECONDS:
                while attempts and attempts[0][0] <= elapsed:
                    _, model, thinking = attempts.pop(0)
                    pending.add(
                        asyncio.create_task(self._generate(prompt, model, thinking))
                    )
                if not pending:
                    if not attempts:
                        break
                    await asyncio.sleep(attempts[0][0] - elapsed)
                    continue
                next_at = attempts[0][0] if attempts else REFINE_TIMEOUT_SECONDS
                done, pending = await asyncio.wait(
                    pending,
                    timeout=next_at - elapsed,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in done:
                    if task.exception() is None and task.result():
                        return task.result()
                    logger.warning("Refinement request failed: %s", task.exception())
            logger.warning("Refinement gave no answer; keeping the live translation")
            return None
        finally:
            for task in pending:
                task.cancel()

    async def _generate(
        self, prompt: str, model: str, thinking: types.ThinkingConfig
    ) -> str:
        response = await self.client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0, thinking_config=thinking),
        )
        return (response.text or "").strip()


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
        self.refine_model = settings.refine_model

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
        to_refine: asyncio.Queue[LiveEvent | None] = asyncio.Queue()
        refiner = asyncio.create_task(self._refine_subtitles(to_refine, events))

        async def publish(event: LiveEvent) -> None:
            if event["type"] != "final" or not self.refine_model:
                await events.put(event)
                return
            # The live English lags the Chinese, so at the cut it mostly belongs to the
            # previous clause: show the Chinese now and the English once refined.
            logger.info("Subtitle #%d: [ZH] %s", event["id"], event["chinese"])
            await events.put({**event, "english": ""})
            await to_refine.put(event)

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
                        session, audio_queue, segmenter, publish
                    )
                # The server ended the session (time limit or GoAway) while the speaker is
                # still talking: start a fresh one. Pending text belongs to the old session.
                for event in segmenter.flush():
                    await publish(event)
                if mic_open:
                    logger.info("Gemini Live session ended; reconnecting")
        except asyncio.CancelledError:
            refiner.cancel()
            raise
        except Exception as exc:
            logger.exception("Gemini Live session failure")
            for event in segmenter.flush():
                await publish(event)
            status: LiveEvent = {
                "type": "error",
                "error": str(exc),
                "timestamp": time.strftime("%H:%M:%S"),
            }
        else:
            status = {"type": "session_status", "status": "disconnected"}
        finally:
            # Let the last subtitles finish refining before the session closes.
            await to_refine.put(None)
            await asyncio.gather(refiner, return_exceptions=True)
        await events.put(status)
        await events.put(None)

    async def _refine_subtitles(
        self,
        to_refine: asyncio.Queue[LiveEvent | None],
        events: asyncio.Queue[LiveEvent | None],
    ) -> None:
        """Fill in each subtitle's English from the text model, in order.

        Falls back to the Live model's English when the text model fails.
        """
        refiner = TranslationRefiner(self.client, self.refine_model)
        while (subtitle := await to_refine.get()) is not None:
            english = await refiner.refine(subtitle["chinese"], subtitle["english"])
            english = english or subtitle["english"]
            logger.info("Subtitle #%d: [EN] %s", subtitle["id"], english)
            if english:
                await events.put({**subtitle, "english": english})

    async def _stream(
        self,
        session: Any,
        audio_queue: asyncio.Queue[bytes | None],
        segmenter: SubtitleSegmenter,
        publish: Callable[[LiveEvent], Awaitable[None]],
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
                        await publish(event)

        async def tick() -> None:
            while True:
                await asyncio.sleep(0.25)
                for event in segmenter.tick(time.monotonic()):
                    await publish(event)

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
