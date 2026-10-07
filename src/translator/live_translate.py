"""Real-time Speech Translation Engine powered by Gemini 3.8 Live (1-Step Architecture).

This module streams raw microphone speech (Chinese with mixed English code-switching)
directly to the Gemini 3.8 Live API, which performs simultaneous speech recognition
and translation, emitting fluent English subtitle tokens with sub-second latency.
"""

import asyncio
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
    """1-step real-time streaming translator powered by Gemini 3.8 Live.

    Attributes:
        live_model: Gemini Live model identifier (e.g., 'gemini-3.8-live').
        use_vertex: Boolean indicating whether Vertex AI or AI Studio backend is used.
        client: Authenticated Google GenAI SDK client.
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

    def _build_live_connect_config(self) -> types.LiveConnectConfig:
        """Construct the LiveConnectConfig for direct 1-step speech-to-English translation."""
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

        return types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            output_audio_transcription=types.AudioTranscriptionConfig(),
            translation_config=types.TranslationConfig(
                target_language_code=self.target_language_code,
            ),
            system_instruction=types.Content(
                parts=[types.Part(text=self.system_instruction)]
            ),
            input_audio_transcription=types.AudioTranscriptionConfig(
                language_codes=lang_codes if lang_codes else ["zh-CN", "en-US"],
                mode=stt_mode,
                custom_vocabulary=custom_vocab,
            ),
            realtime_input_config=types.RealtimeInputConfig(
                turn_coverage="TURN_INCLUDES_ONLY_ACTIVITY",
                automatic_activity_detection=types.AutomaticActivityDetection(
                    start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                    end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                    silence_duration_ms=350,
                    prefix_padding_ms=80,
                ),
            ),
            temperature=settings.temperature,
        )

    async def start_session(
        self,
        audio_input_queue: asyncio.Queue[bytes],
        text_input_queue: asyncio.Queue[str] | None = None,
        audio_interrupt_callback: Callable[[], Any] | None = None,
    ) -> AsyncGenerator[LiveEvent]:
        """Start a 1-step Gemini 3.8 Live streaming translation session yielding real-time events.

        Args:
            audio_input_queue: Async queue receiving raw 16kHz linear PCM frames.
            text_input_queue: Optional async queue for ad-hoc text prompts.
            audio_interrupt_callback: Callback invoked when the model detects an interruption.

        Yields:
            LiveEvent dictionaries (session_status, partial, final, interrupted, error).
        """
        live_config = self._build_live_connect_config()
        backend_desc = (
            f"Vertex AI ({self.location})" if self.use_vertex else "Google AI Studio"
        )
        logger.info(
            "Connecting to Gemini Live (%s) via %s...",
            self.live_model,
            backend_desc,
        )

        try:
            async with self.client.aio.live.connect(
                model=self.live_model, config=live_config
            ) as session:
                logger.info("Gemini Live translation session established successfully")
                yield {
                    "type": "session_status",
                    "status": "connected",
                    "model": self.live_model,
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

                async def send_text_loop() -> None:
                    if not text_input_queue:
                        return
                    try:
                        while True:
                            text = await text_input_queue.get()
                            if text is None:
                                break
                            await session.send_client_content(
                                turns=[
                                    types.Content(
                                        parts=[types.Part(text=text)],
                                        role="user",
                                    )
                                ],
                                turn_complete=True,
                            )
                    except asyncio.CancelledError:
                        pass
                    except Exception as exc:
                        logger.error("Error sending text to Gemini Live: %s", exc)

                async def receive_live_loop() -> None:
                    sentence_id = 0
                    accumulated_english: list[str] = []
                    current_chinese = ""

                    try:
                        while True:
                            turn_had_content = False
                            async for response in session.receive():
                                turn_had_content = True
                                if response.go_away:
                                    logger.warning("Server sent GoAway: %s", response.go_away)
                                    await event_queue.put(
                                        {
                                            "type": "go_away",
                                            "time_left": str(response.go_away.time_left)
                                            if hasattr(response.go_away, "time_left")
                                            else None,
                                        }
                                    )

                                server_content = response.server_content
                                if not server_content:
                                    continue

                                # 1. User interruption / barge-in
                                if server_content.interrupted:
                                    if audio_interrupt_callback:
                                        if inspect.iscoroutinefunction(audio_interrupt_callback):
                                            await audio_interrupt_callback()
                                        else:
                                            audio_interrupt_callback()
                                    accumulated_english.clear()
                                    current_chinese = ""
                                    await event_queue.put({"type": "interrupted"})

                                # 2. Chinese interim speech recognition from mic
                                if (
                                    server_content.interim_input_transcription
                                    and server_content.interim_input_transcription.text
                                ):
                                    interim_text = (
                                        server_content.interim_input_transcription.text.strip()
                                    )
                                    if interim_text and interim_text != current_chinese:
                                        current_chinese = interim_text
                                        await event_queue.put(
                                            {
                                                "type": "partial",
                                                "id": sentence_id + 1,
                                                "chinese": current_chinese,
                                                "english": "".join(accumulated_english).strip(),
                                            }
                                        )

                                # 3. Stabilized Chinese input transcription
                                if (
                                    server_content.input_transcription
                                    and server_content.input_transcription.text
                                ):
                                    final_text = server_content.input_transcription.text.strip()
                                    if final_text:
                                        current_chinese = final_text

                                # 4. 1-Step streaming English translation from Gemini 3.8 Live
                                streamed_text = ""
                                out_trans = getattr(server_content, "output_transcription", None)
                                if (
                                    out_trans
                                    and isinstance(getattr(out_trans, "text", None), str)
                                    and out_trans.text
                                ):
                                    streamed_text = out_trans.text
                                elif server_content.model_turn:
                                    text_parts = [
                                        part.text
                                        for part in getattr(server_content.model_turn, "parts", [])
                                        if isinstance(getattr(part, "text", None), str) and part.text
                                    ]
                                    if text_parts:
                                        streamed_text = "".join(text_parts)

                                if streamed_text:
                                    accumulated_english.append(streamed_text)
                                    await event_queue.put(
                                        {
                                            "type": "partial",
                                            "id": sentence_id + 1,
                                            "chinese": current_chinese,
                                            "english": "".join(accumulated_english).strip(),
                                        }
                                    )

                                # 5. Turn / generation completion: finalize subtitle segment
                                if (
                                    server_content.turn_complete
                                    or server_content.generation_complete
                                ):
                                    final_english = "".join(accumulated_english).strip()
                                    final_chinese = current_chinese.strip()
                                    if final_english or final_chinese:
                                        sentence_id += 1
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

                            if not turn_had_content:
                                # Avoid busy loop if session.receive() exited without messages
                                await asyncio.sleep(0.05)
                    except asyncio.CancelledError:
                        pass
                    except Exception:
                        logger.exception("Exception in Gemini Live receive loop")
                    finally:
                        await event_queue.put(None)

                send_audio_task = asyncio.create_task(send_audio_loop())
                send_text_task = asyncio.create_task(send_text_loop())
                receive_live_task = asyncio.create_task(receive_live_loop())

                try:
                    while True:
                        event = await event_queue.get()
                        if event is None:
                            break
                        yield event
                finally:
                    for task in [send_audio_task, send_text_task, receive_live_task]:
                        task.cancel()
                    await asyncio.gather(
                        send_audio_task,
                        send_text_task,
                        receive_live_task,
                        return_exceptions=True,
                    )

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
