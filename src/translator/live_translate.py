"""Real-time Speech Translation Engine powered by Gemini Live API (1-Step SOTA Architecture).

This module implements Google's official Gemini Live API development best practices:
- Low-latency bidirectional WebSocket streaming over PCM 16kHz mono.
- Native Live Translation configuration with echo_target_language for seamless code-switching.
- Context window compression to lift the 15-minute uncompressed session ceiling.
- Automatic session resumption tokens to survive socket drops and connection resets.
- Hybrid Voice Activity Detection (audio_stream_end) for instantaneous turn finalization.
- Multi-part event decoding processing transcripts and synthesized audio chunks concurrently.
"""

import asyncio
import base64
import inspect
import logging
import time
from collections.abc import AsyncGenerator, Callable
from typing import Any, NotRequired, TypedDict

from google import genai
from google.genai import types

from translator.config import (
    build_wedding_translation_instruction,
    settings,
)

logger = logging.getLogger("wedding_translator.live_translate")


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
    time_left: NotRequired[str | None]
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
        effective_location = location
        if not effective_location or effective_location.lower() == "global":
            logger.info(
                "Vertex AI Gemini Live API requires a regional endpoint; mapping '%s' to 'us-central1'",
                location,
            )
            effective_location = "us-central1"

        logger.info(
            "Initializing Google GenAI Client with Vertex AI (project=%s, location=%s)",
            project_id,
            effective_location,
        )
        return genai.Client(
            vertexai=True,
            project=project_id,
            location=effective_location,
        )

    logger.info("Initializing Google GenAI Client with Google AI Studio")
    return genai.Client(
        vertexai=False,
        api_key=api_key or None,
    )


class GeminiLiveTranslator:
    """SOTA real-time streaming translator powered by the Google Gemini Live API.

    Attributes:
        live_model: Gemini Live model identifier (e.g., 'gemini-3.8-live' or 'gemini-3.5-live-translate-preview').
        use_vertex: Boolean indicating whether Vertex AI or AI Studio backend is used.
        client: Authenticated Google GenAI SDK client.
        last_resumption_handle: Last session resumption token received from the server.
    """

    def __init__(
        self,
        live_model: str | None = None,
        input_sample_rate: int = 16000,
        target_language_code: str = "en",
        project_id: str | None = None,
        location: str | None = None,
        api_key: str | None = None,
        use_vertex: bool | None = None,
        system_instruction: str | None = None,
    ) -> None:
        self.live_model = live_model or settings.live_model
        self.input_sample_rate = input_sample_rate
        self.target_language_code = target_language_code or settings.target_language
        self.project_id = project_id or settings.google_cloud_project
        self.location = location or settings.google_cloud_location
        self.api_key = api_key or settings.gemini_api_key
        self.use_vertex = settings.use_vertex if use_vertex is None else use_vertex
        self.system_instruction = (
            system_instruction or build_wedding_translation_instruction()
        )

        self.client = create_genai_client(
            use_vertex=self.use_vertex,
            project_id=self.project_id,
            location=self.location,
            api_key=self.api_key,
        )
        self.current_english: str = ""
        self.current_chinese: str = ""
        self.last_resumption_handle: str | None = None

    def _build_live_connect_config(
        self, resumption_handle: str | None = None
    ) -> types.LiveConnectConfig:
        """Construct the SOTA LiveConnectConfig following Google official guidelines.

        Features enabled:
        - types.TranslationConfig with target_language_code and echo_target_language.
        - types.ContextWindowCompressionConfig with SlidingWindow to eliminate 15-min limit.
        - types.SessionResumptionConfig with resumption handle to survive socket resets.
        - Audio transcription configs with neural biasing and custom vocabulary.
        - Automatic activity detection tuned for snappy turn detection.
        """
        lang_codes = [
            c.strip()
            for c in settings.stt_language_codes.split(",")
            if c.strip() and c.strip().lower() != "auto"
        ]
        stt_mode = (
            types.AudioTranscriptionConfigMode.SMART
            if settings.stt_mode == "SMART"
            else types.AudioTranscriptionConfigMode.VERBATIM
        )
        custom_vocab = settings.wedding.get_vocabulary_list()
        is_pure_translate = "translate" in self.live_model.lower()

        # Build Session Resumption config if enabled
        session_resumption = None
        if settings.enable_session_resumption:
            session_resumption = (
                types.SessionResumptionConfig(handle=resumption_handle)
                if resumption_handle
                else types.SessionResumptionConfig()
            )

        # Build Context Window Compression config if enabled
        context_compression = None
        if settings.enable_context_compression:
            context_compression = types.ContextWindowCompressionConfig(
                sliding_window=types.SlidingWindow(),
            )

        config_kwargs: dict[str, Any] = {
            "response_modalities": [types.Modality.AUDIO],
            "output_audio_transcription": types.AudioTranscriptionConfig(),
            "translation_config": types.TranslationConfig(
                target_language_code=self.target_language_code,
                echo_target_language=settings.echo_target_language,
            ),
            "input_audio_transcription": types.AudioTranscriptionConfig(
                language_codes=lang_codes if lang_codes else ["zh-CN", "en-US"],
                mode=stt_mode,
                custom_vocabulary=custom_vocab,
            ),
            "realtime_input_config": types.RealtimeInputConfig(
                turn_coverage="TURN_INCLUDES_ONLY_ACTIVITY",
                automatic_activity_detection=types.AutomaticActivityDetection(
                    start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                    end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                    silence_duration_ms=settings.vad_silence_duration_ms,
                    prefix_padding_ms=40,
                ),
                activity_handling=types.ActivityHandling.NO_INTERRUPTION,
            ),
        }

        if session_resumption:
            config_kwargs["session_resumption"] = session_resumption
        if context_compression:
            config_kwargs["context_window_compression"] = context_compression

        # gemini-3.5-live-translate-preview is a dedicated translation pipeline model
        # which does not accept system_instruction or temperature
        if not is_pure_translate:
            config_kwargs["system_instruction"] = types.Content(
                parts=[types.Part(text=self.system_instruction)]
            )
            config_kwargs["temperature"] = settings.temperature

        return types.LiveConnectConfig(**config_kwargs)

    async def start_session(
        self,
        audio_input_queue: asyncio.Queue[bytes],
        text_input_queue: asyncio.Queue[str] | None = None,
        control_queue: asyncio.Queue[str] | None = None,
        audio_interrupt_callback: Callable[[], Any] | None = None,
    ) -> AsyncGenerator[LiveEvent]:
        """Start a SOTA Gemini Live streaming translation session yielding real-time events.

        Args:
            audio_input_queue: Async queue receiving raw 16kHz linear PCM frames.
            text_input_queue: Optional async queue for real-time text input prompts.
            control_queue: Optional async queue for Hybrid VAD control messages ('stream_end').
            audio_interrupt_callback: Callback invoked when the model detects an interruption.

        Yields:
            LiveEvent dictionaries (session_status, partial, final, interrupted, audio, error).
        """
        model_to_use = self.live_model
        live_config = self._build_live_connect_config(
            resumption_handle=self.last_resumption_handle
        )
        backend_desc = (
            f"Vertex AI ({self.location})" if self.use_vertex else "Google AI Studio"
        )
        logger.info(
            "Connecting to Gemini Live (%s) via %s (resumption_handle=%s)...",
            model_to_use,
            backend_desc,
            bool(self.last_resumption_handle),
        )

        try:
            # Connect to Gemini Live with automatic fallback if preview model is exhausted
            try:
                session_cm = self.client.aio.live.connect(
                    model=model_to_use, config=live_config
                )
                session = await session_cm.__aenter__()
            except Exception as connect_err:
                err_str = str(connect_err)
                if "translate" in model_to_use.lower() and (
                    "1011" in err_str
                    or "Resource exhausted" in err_str
                    or "not found" in err_str
                ):
                    fallback = "gemini-3.8-live"
                    logger.warning(
                        "Model '%s' hit quota or was not found (%s). Falling back to '%s'...",
                        model_to_use,
                        err_str,
                        fallback,
                    )
                    model_to_use = fallback
                    fallback_config = self._build_live_connect_config(
                        resumption_handle=self.last_resumption_handle
                    )
                    session_cm = self.client.aio.live.connect(
                        model=model_to_use, config=fallback_config
                    )
                    session = await session_cm.__aenter__()
                else:
                    raise

            try:
                logger.info(
                    "Gemini Live translation session established successfully using %s",
                    model_to_use,
                )
                yield {
                    "type": "session_status",
                    "status": "connected",
                    "model": model_to_use,
                    "use_vertex": self.use_vertex,
                }

                event_queue: asyncio.Queue[LiveEvent | None] = asyncio.Queue()

                async def send_audio_loop() -> None:
                    try:
                        while True:
                            pcm_data = await audio_input_queue.get()
                            if pcm_data is None:
                                break
                            await session.send_realtime_input(
                                audio=types.Blob(
                                    data=pcm_data,
                                    mime_type=f"audio/pcm;rate={self.input_sample_rate}",
                                )
                            )
                    except asyncio.CancelledError:
                        pass
                    except Exception as exc:
                        logger.error("Error sending audio to Gemini Live: %s", exc)

                async def send_control_loop() -> None:
                    """Hybrid VAD control loop: notify turn end on client-detected speech boundary."""
                    if not control_queue:
                        return
                    try:
                        while True:
                            cmd = await control_queue.get()
                            if cmd is None:
                                break
                            if cmd in ("stream_end", "turn_end", "client_silence"):
                                logger.info(
                                    "Hybrid VAD: sending audio_stream_end=True for zero-latency turn finish"
                                )
                                await session.send_realtime_input(audio_stream_end=True)
                    except asyncio.CancelledError:
                        pass
                    except Exception as exc:
                        logger.error("Error in Hybrid VAD control loop: %s", exc)

                async def send_text_loop() -> None:
                    """Send real-time text input per Google guidelines using send_realtime_input."""
                    if not text_input_queue:
                        return
                    try:
                        while True:
                            text = await text_input_queue.get()
                            if text is None:
                                break
                            await session.send_realtime_input(text=text)
                    except asyncio.CancelledError:
                        pass
                    except Exception as exc:
                        logger.error("Error sending text to Gemini Live: %s", exc)

                async def receive_live_loop() -> None:
                    sentence_id = 0
                    accumulated_english: list[str] = []
                    current_chinese = ""
                    last_content_time = 0.0
                    commit_lock = asyncio.Lock()

                    async def commit_current_utterance(
                        reason: str = "complete",
                    ) -> bool:
                        nonlocal sentence_id, current_chinese, last_content_time
                        async with commit_lock:
                            final_english = "".join(accumulated_english).strip()
                            final_chinese = (
                                current_chinese.strip() or self.current_chinese.strip()
                            )
                            # Guard: For silence_timeout or new_utterance_started, do NOT commit if English is empty
                            if (
                                reason in ("silence_timeout", "new_utterance_started")
                                and not final_english
                            ):
                                return False

                            if final_english or final_chinese:
                                sentence_id += 1
                                logger.info(
                                    "Committing subtitle #%d (%s): [ZH] %s -> [EN] %s",
                                    sentence_id,
                                    reason,
                                    final_chinese,
                                    final_english,
                                )
                                await event_queue.put(
                                    {
                                        "type": "final",
                                        "id": sentence_id,
                                        "chinese": final_chinese,
                                        "english": final_english,
                                        "timestamp": time.strftime("%H:%M:%S"),
                                    }
                                )
                                accumulated_english.clear()
                                current_chinese = ""
                                self.current_english = ""
                                self.current_chinese = ""
                                last_content_time = 0.0
                                return True
                            return False

                    async def silence_auto_flush_loop() -> None:
                        try:
                            while True:
                                await asyncio.sleep(0.25)
                                now = time.time()
                                if (
                                    last_content_time > 0
                                    and (now - last_content_time) >= 2.5
                                    and (accumulated_english or current_chinese)
                                ):
                                    await commit_current_utterance(
                                        reason="silence_timeout"
                                    )
                        except asyncio.CancelledError:
                            pass

                    flush_task = asyncio.create_task(silence_auto_flush_loop())

                    try:
                        while True:
                            turn_had_content = False
                            async for response in session.receive():
                                turn_had_content = True

                                # 1. Session Resumption Token Update (Google Live API Best Practice)
                                if getattr(response, "session_resumption_update", None):
                                    res_update = response.session_resumption_update
                                    if getattr(
                                        res_update, "resumable", False
                                    ) and getattr(res_update, "new_handle", None):
                                        self.last_resumption_handle = (
                                            res_update.new_handle
                                        )
                                        logger.debug(
                                            "Live session resumption token updated: %s...",
                                            res_update.new_handle[:16],
                                        )

                                # 2. GoAway Signal Handling
                                if getattr(response, "go_away", None):
                                    time_left = getattr(
                                        response.go_away, "time_left", None
                                    )
                                    logger.warning(
                                        "Gemini Live server sent GoAway (time_left=%s)",
                                        time_left,
                                    )
                                    await event_queue.put(
                                        {
                                            "type": "go_away",
                                            "time_left": str(time_left)
                                            if time_left
                                            else None,
                                        }
                                    )

                                server_content = getattr(
                                    response, "server_content", None
                                )
                                if not server_content:
                                    continue

                                # 3. User interruption / barge-in: commit accumulated subtitle rather than dropping it
                                if getattr(server_content, "interrupted", False):
                                    if audio_interrupt_callback:
                                        if inspect.iscoroutinefunction(
                                            audio_interrupt_callback
                                        ):
                                            await audio_interrupt_callback()
                                        else:
                                            audio_interrupt_callback()
                                    committed = await commit_current_utterance(
                                        reason="interrupted"
                                    )
                                    if not committed:
                                        accumulated_english.clear()
                                        current_chinese = ""
                                        self.current_english = ""
                                        self.current_chinese = ""

                                # 4. Chinese interim speech recognition from mic
                                interim_trans = getattr(
                                    server_content, "interim_input_transcription", None
                                )
                                if interim_trans and getattr(
                                    interim_trans, "text", None
                                ):
                                    interim_text = interim_trans.text.strip()
                                    if interim_text:
                                        last_content_time = time.time()
                                        # If prior sentence was translated and new utterance begins, commit prior sentence
                                        if (
                                            accumulated_english
                                            and current_chinese
                                            and not interim_text.startswith(
                                                current_chinese[
                                                    : min(4, len(current_chinese))
                                                ]
                                            )
                                        ):
                                            await commit_current_utterance(
                                                reason="new_utterance_started"
                                            )

                                        if interim_text != current_chinese:
                                            current_chinese = interim_text
                                            self.current_chinese = current_chinese
                                            await event_queue.put(
                                                {
                                                    "type": "partial",
                                                    "id": sentence_id + 1,
                                                    "chinese": current_chinese,
                                                    "english": "".join(
                                                        accumulated_english
                                                    ).strip(),
                                                }
                                            )

                                # 5. Stabilized Chinese input transcription from Gemini Live
                                final_trans = getattr(
                                    server_content, "input_transcription", None
                                )
                                if final_trans and getattr(final_trans, "text", None):
                                    final_text = final_trans.text.strip()
                                    if final_text:
                                        last_content_time = time.time()
                                        if (
                                            accumulated_english
                                            and current_chinese
                                            and not final_text.startswith(
                                                current_chinese[
                                                    : min(4, len(current_chinese))
                                                ]
                                            )
                                        ):
                                            await commit_current_utterance(
                                                reason="new_utterance_started"
                                            )

                                        if final_text != current_chinese:
                                            current_chinese = final_text
                                            self.current_chinese = current_chinese
                                            await event_queue.put(
                                                {
                                                    "type": "partial",
                                                    "id": sentence_id + 1,
                                                    "chinese": current_chinese,
                                                    "english": "".join(
                                                        accumulated_english
                                                    ).strip(),
                                                }
                                            )

                                # 6. Multi-part event decoding: streaming English translation & synthesized audio
                                streamed_text = ""
                                out_trans = getattr(
                                    server_content, "output_transcription", None
                                )
                                if (
                                    out_trans
                                    and isinstance(
                                        getattr(out_trans, "text", None), str
                                    )
                                    and out_trans.text
                                ):
                                    streamed_text = out_trans.text

                                if server_content.model_turn:
                                    for part in getattr(
                                        server_content.model_turn, "parts", []
                                    ):
                                        # Synthesized audio frames (for audience wireless listening)
                                        inline = getattr(part, "inline_data", None)
                                        if (
                                            inline
                                            and getattr(inline, "data", None)
                                            and settings.enable_audio_broadcast
                                        ):
                                            audio_b64 = base64.b64encode(
                                                inline.data
                                            ).decode("ascii")
                                            await event_queue.put(
                                                {
                                                    "type": "audio",
                                                    "data": audio_b64,
                                                    "sample_rate": 24000,
                                                }
                                            )
                                        # Model text parts if output_transcription was absent
                                        if not streamed_text and getattr(
                                            part, "text", None
                                        ):
                                            streamed_text += part.text

                                if streamed_text:
                                    accumulated_english.append(streamed_text)
                                    self.current_english = "".join(
                                        accumulated_english
                                    ).strip()
                                    last_content_time = time.time()
                                    await event_queue.put(
                                        {
                                            "type": "partial",
                                            "id": sentence_id + 1,
                                            "chinese": current_chinese,
                                            "english": self.current_english,
                                        }
                                    )

                                # 7. Turn / generation completion: finalize subtitle segment
                                if getattr(
                                    server_content, "turn_complete", False
                                ) or getattr(
                                    server_content, "generation_complete", False
                                ):
                                    await commit_current_utterance(
                                        reason="turn_complete"
                                    )

                            if not turn_had_content:
                                await asyncio.sleep(0.05)
                    except asyncio.CancelledError:
                        pass
                    except Exception:
                        logger.exception("Exception in Gemini Live receive loop")
                    finally:
                        flush_task.cancel()
                        await event_queue.put(None)

                send_audio_task = asyncio.create_task(send_audio_loop())
                send_control_task = asyncio.create_task(send_control_loop())
                send_text_task = asyncio.create_task(send_text_loop())
                receive_live_task = asyncio.create_task(receive_live_loop())

                try:
                    while True:
                        event = await event_queue.get()
                        if event is None:
                            break
                        yield event
                finally:
                    for task in [
                        send_audio_task,
                        send_control_task,
                        send_text_task,
                        receive_live_task,
                    ]:
                        task.cancel()
                    await asyncio.gather(
                        send_audio_task,
                        send_control_task,
                        send_text_task,
                        receive_live_task,
                        return_exceptions=True,
                    )
            finally:
                await session_cm.__aexit__(None, None, None)

        except (GeneratorExit, asyncio.CancelledError):
            logger.info("Gemini Live translation session terminated")
            raise
        except Exception as exc:
            logger.exception("Gemini Live session failure")
            yield {
                "type": "error",
                "error": str(exc),
                "timestamp": time.strftime("%H:%M:%S"),
            }
        else:
            yield {"type": "session_status", "status": "disconnected"}
        finally:
            logger.info("Gemini Live translation session closed")


def create_translator(**kwargs: Any) -> GeminiLiveTranslator:
    """Factory function to instantiate GeminiLiveTranslator."""
    return GeminiLiveTranslator(**kwargs)
