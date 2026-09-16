"""Real-time Speech-to-Text & Translation Engine (Two-Step Transcribe API Architecture).

Step 1: Real-time Live Chinese ASR using `gemini-3.5-transcribe-live-preview`.
Step 2: Low-latency wedding-context bilingual translation using `gemini-3.5-flash`.
"""

import asyncio
import inspect
import logging
import time
import traceback
from collections.abc import AsyncGenerator, Callable
from typing import Any

from google import genai
from google.genai import types

from translator.config import (
    build_wedding_translation_instruction,
    settings,
)

logger = logging.getLogger("wedding_translator.live_translate")


class GeminiLiveTranslator:
    """Two-step streaming translator decoupling ASR and LLM translation:

    1. Real-time Chinese Speech-to-Text:
       Uses `gemini-3.5-transcribe-live-preview` via Gemini Live WebSocket API.
       Streams audio in 16kHz PCM, yields sub-second interim Chinese transcripts,
       and stabilizes punctuated clauses with custom wedding vocabulary biasing.

    2. Real-time Wedding-Context Translation:
       As soon as a clause completes, translates Chinese to natural, poetic
       English subtitles using `gemini-3.5-flash` with `thinking_budget=0`.
       Streams English subtitle tokens to client displays with minimal latency.
    """

    def __init__(
        self,
        transcribe_model: str | None = None,
        translation_model: str | None = None,
        input_sample_rate: int = 16000,
        target_language_code: str = "en",
        project_id: str | None = None,
        location: str | None = None,
        api_key: str | None = None,
        voice_name: str = "Puck",
        system_instruction: str | None = None,
    ):
        self.transcribe_model = transcribe_model or settings.transcribe_model
        self.translation_model = translation_model or settings.translation_model
        self.input_sample_rate = input_sample_rate
        self.target_language_code = target_language_code
        self.project_id = project_id or settings.gcp_project_id
        self.location = location or settings.gcp_location
        self.api_key = api_key
        self.voice_name = voice_name
        self.system_instruction = (
            system_instruction or build_wedding_translation_instruction()
        )

        self.client = genai.Client(
            vertexai=True,
            project=self.project_id,
            location=self.location,
        )

    async def start_session(
        self,
        audio_input_queue: asyncio.Queue[bytes],
        text_input_queue: asyncio.Queue[str] | None = None,
        audio_output_callback: Callable[[bytes], Any] | None = None,
        audio_interrupt_callback: Callable[[], Any] | None = None,
    ) -> AsyncGenerator[dict[str, Any]]:
        """Start a two-step transcription & translation session yielding live events."""
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

        asr_config = types.LiveConnectConfig(
            response_modalities=[types.Modality.TEXT],
            input_audio_transcription=types.AudioTranscriptionConfig(
                language_codes=lang_codes if lang_codes else None,
                mode=stt_mode,
                custom_vocabulary=custom_vocab,
            ),
            realtime_input_config=types.RealtimeInputConfig(
                turn_coverage="TURN_INCLUDES_ONLY_ACTIVITY",
            ),
        )

        logger.info(
            f"Connecting to Gemini Live Transcribe with model={self.transcribe_model} "
            f"(translation={self.translation_model}, location={self.location})..."
        )

        try:
            async with self.client.aio.live.connect(
                model=self.transcribe_model, config=asr_config
            ) as session:
                logger.info("Gemini Live Transcribe session opened successfully")
                yield {
                    "type": "session_status",
                    "status": "connected",
                    "model": f"{self.transcribe_model} + {self.translation_model}",
                }

                event_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
                active_translation_tasks: set[asyncio.Task] = set()
                sentence_id = 0

                async def send_audio_loop():
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
                    except Exception as e:
                        logger.error(f"Error in send_audio_loop: {e}")

                async def send_text_loop():
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
                    except Exception as e:
                        logger.error(f"Error in send_text_loop: {e}")

                async def translate_sentence(chinese_text: str, s_id: int):
                    """Translates finalized Chinese speech into English subtitles using Gemini 2.5 Flash."""
                    try:
                        prompt = f"Chinese speech: {chinese_text}"
                        chat = self.client.aio.chats.create(
                            model=self.translation_model,
                            config=types.GenerateContentConfig(
                                temperature=settings.temperature,
                                thinking_config=types.ThinkingConfig(
                                    thinking_budget=settings.translation_thinking_budget
                                ),
                                system_instruction=self.system_instruction,
                                max_output_tokens=160,
                            ),
                        )

                        stream = await chat.send_message_stream(prompt)
                        accumulated_english = []
                        last_stream_emit = 0.0

                        async for chunk in stream:
                            if chunk.text:
                                accumulated_english.append(chunk.text)
                                now = time.time()
                                if now - last_stream_emit >= 0.04:
                                    last_stream_emit = now
                                    await event_queue.put(
                                        {
                                            "type": "partial",
                                            "id": s_id,
                                            "chinese": chinese_text,
                                            "english": "".join(
                                                accumulated_english
                                            ).strip(),
                                        }
                                    )

                        final_english = "".join(accumulated_english).strip()
                        await event_queue.put(
                            {
                                "type": "final",
                                "id": s_id,
                                "chinese": chinese_text,
                                "english": final_english,
                                "timestamp": time.strftime("%H:%M:%S"),
                            }
                        )

                    except asyncio.CancelledError:
                        pass
                    except Exception as ex:
                        logger.error(f"Translation failed for sentence {s_id}: {ex}")
                        # Fallback: still publish Chinese subtitle if translation encountered error
                        await event_queue.put(
                            {
                                "type": "final",
                                "id": s_id,
                                "chinese": chinese_text,
                                "english": "",
                                "timestamp": time.strftime("%H:%M:%S"),
                            }
                        )

                async def receive_asr_loop():
                    nonlocal sentence_id
                    last_interim_emit = 0.0
                    try:
                        while True:
                            async for response in session.receive():
                                if response.go_away:
                                    logger.warning(
                                        f"Server sent GoAway signal: {response.go_away}"
                                    )
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

                                # 1. Check interruption
                                if server_content.interrupted:
                                    if audio_interrupt_callback:
                                        if inspect.iscoroutinefunction(
                                            audio_interrupt_callback
                                        ):
                                            await audio_interrupt_callback()
                                        else:
                                            audio_interrupt_callback()
                                    await event_queue.put({"type": "interrupted"})

                                # 2. Real-time sub-second Chinese interim preview
                                if (
                                    server_content.interim_input_transcription
                                    and server_content.interim_input_transcription.text
                                ):
                                    interim_text = server_content.interim_input_transcription.text.strip()
                                    now = time.time()
                                    if now - last_interim_emit >= 0.03:
                                        last_interim_emit = now
                                        await event_queue.put(
                                            {
                                                "type": "partial",
                                                "chinese": interim_text,
                                                "english": "",
                                            }
                                        )

                                # 3. Finalized ASR sentence completion
                                if (
                                    server_content.input_transcription
                                    and server_content.input_transcription.text
                                ):
                                    final_text = (
                                        server_content.input_transcription.text.strip()
                                    )
                                    if final_text:
                                        sentence_id += 1
                                        cur_id = sentence_id
                                        # Spawn translation in non-blocking background task
                                        t_task = asyncio.create_task(
                                            translate_sentence(final_text, cur_id)
                                        )
                                        active_translation_tasks.add(t_task)
                                        t_task.add_done_callback(
                                            active_translation_tasks.discard
                                        )

                    except asyncio.CancelledError:
                        pass
                    except Exception as e:
                        logger.error(
                            f"Error in receive_asr_loop: {e}\n{traceback.format_exc()}"
                        )

                send_audio_task = asyncio.create_task(send_audio_loop())
                send_text_task = asyncio.create_task(send_text_loop())
                receive_asr_task = asyncio.create_task(receive_asr_loop())

                try:
                    while True:
                        done, _ = await asyncio.wait(
                            [
                                asyncio.create_task(event_queue.get()),
                                send_audio_task,
                                receive_asr_task,
                            ],
                            return_when=asyncio.FIRST_COMPLETED,
                        )

                        for task in done:
                            if task is send_audio_task:
                                if send_audio_task.exception():
                                    raise send_audio_task.exception()
                            elif task is receive_asr_task:
                                if receive_asr_task.exception():
                                    raise receive_asr_task.exception()
                                return
                            else:
                                event = task.result()
                                yield event

                finally:
                    send_audio_task.cancel()
                    send_text_task.cancel()
                    receive_asr_task.cancel()
                    for t in active_translation_tasks:
                        if not t.done():
                            t.cancel()
                    await asyncio.gather(
                        send_audio_task,
                        send_text_task,
                        receive_asr_task,
                        return_exceptions=True,
                    )

        except Exception as e:
            logger.error(f"Gemini Live Transcribe session failed: {e}")
            yield {
                "type": "error",
                "error": str(e),
                "timestamp": time.strftime("%H:%M:%S"),
            }
        finally:
            logger.info("Gemini Live Transcribe session closed")
            yield {"type": "session_status", "status": "disconnected"}


# Aliases for convenience
GeminiTwoStepTranslator = GeminiLiveTranslator


def create_translator(**kwargs: Any) -> GeminiLiveTranslator:
    """Create the live translator engine."""
    return GeminiLiveTranslator(**kwargs)
