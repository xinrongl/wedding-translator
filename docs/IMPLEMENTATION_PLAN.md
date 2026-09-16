# Simplified Architecture & Implementation Plan: Real-time Wedding Speech Translator

## Goal Description
Build a lightweight, low-latency, real-time Chinese-to-English speech translation web application designed specifically for wedding ceremonies and banquets.

The architecture is built entirely around Google's native **Gemini Live Translation API** (`gemini-3.5-live-translate-preview`). This replaces traditional multi-stage pipelines (separate Speech-to-Text, custom clause segmentation algorithms, and downstream translation APIs) with a **single, elegant bidirectional streaming connection**.

```
+---------------------------------------------------------------------------------+
|                            Wedding Speaker Microphone                           |
|                      Web Audio API (Browser) - 16kHz Mono PCM                   |
+----------------------------------------+----------------------------------------+
                                         |
                                         v WebSocket (/ws/speaker)
+---------------------------------------------------------------------------------+
|                          FastAPI Asynchronous Gateway                           |
|                                                                                 |
|   Audio Ingestion Bridge                         Broadcast Hub                  |
|   - Ingests 16kHz PCM chunks                     - Pushes live bilingual        |
|   - Forwards directly to                           subtitles to Projector,      |
|     Gemini Live Session                            Mobile, & Admin Screens      |
|                                                    (/ws/subtitles)              |
+----------------------------------------+----------------------------------------+
                                         |
                         Bidirectional   |   Real-time Audio In
                            WebSocket    |   Simultaneous Transcripts Out
                                         v
+---------------------------------------------------------------------------------+
|                       Google Gemini Live Translation API                        |
|                    Model: gemini-3.5-live-translate-preview                     |
|                    Location: global (Vertex AI ADC Auth)                        |
|                                                                                 |
|   - Real-time Input Transcription (Spoken Chinese)                              |
|   - Real-time Output Transcription (Translated English Subtitles)               |
|   - Optional 24kHz Synthesized English Audio Stream                             |
|   - Ultra-Low End-to-End Latency (~300-500ms)                                   |
+---------------------------------------------------------------------------------+
                                         |
                                         v Broadcast to Viewers
        +--------------------------------+--------------------------------+
        |                                |                                |
        v                                v                                v
+---------------+              +-----------------+             +------------------+
| Projector View|              |   Admin View    |             | Mobile Guest View|
|  (Big Screen, |              | (Mic controls,  |             | (Scannable QR,   |
|   Champagne   |              |  RMS visualizer,|             |  personal phone  |
|   Subtitles)  |              |  status panel)  |             |  subtitles)      |
+---------------+              +-----------------+             +------------------+
```

---

## Architectural Simplicity: Why Pure Gemini Live API?

| Traditional Multi-Stage Pipeline | Pure Gemini Live Translation Pipeline |
| :--- | :--- |
| **3 Disparate Components**: Cloud STT v1/v2 + Custom Clause Segmenter + Gemini Flash / Cloud Translate | **1 Unified Service**: `gemini-3.5-live-translate-preview` over Gemini Live WebSocket |
| **High Multi-Hop Latency**: 300ms ASR + 600ms pause wait + 400ms LLM translation = **~1.3s total lag** | **Ultra-Low Latency**: Streaming audio in -> streaming tokens out = **~300–500ms total lag** |
| **Acoustic Jitter & Run-on Errors**: Spoken Chinese lacks punctuation; requires complex regex splitters and anti-run-on hacks | **Native Acoustic Alignment**: The model understands natural cadence, pauses, and sentence boundaries intrinsically |
| **Heavy Dependencies**: `google-cloud-speech`, `google-cloud-translate`, `google-genai` | **Single Dependency**: `google-genai` (`client.aio.live.connect`) |
| **Text Only**: Subtitles only | **Multimodal Output**: Simultaneous text subtitles + 24kHz synthesized audio for guest headsets |

---

## System Components

### 1. Backend Core (`src/translator/`)

#### [`src/translator/live_translate.py`](file:///home/xinronglin/projects/wedding-translator/src/translator/live_translate.py) (The Core Engine)
#### [`src/translator/live_translate.py`](file:///home/xinronglin/projects/wedding-translator/src/translator/live_translate.py) (The Core Engine)
Adapted directly from the official [`google-gemini/gemini-live-api-examples`](https://github.com/google-gemini/gemini-live-api-examples/blob/main/gemini-live-genai-python-sdk/gemini_live.py):
- **Decoupled Asynchronous Ingestion Queues**:
  `audio_input_queue` and `text_input_queue` ensure audio packet transmission never blocks incoming WebSocket frames.
- **Resilient Receive Loop Pattern**:
  A `while True:` loop wrapping `async for response in session.receive():` to ensure persistent listening even across turn completion and generation cycles.
- **GoAway & Session Resumption Handling**:
  Gracefully handles `response.go_away` and `response.session_resumption_update`.
- **Async Generator Lifecycle**:
  `async def start_session(...)` yields structured events (`session_status`, `interim`, `final`, `audio_level`, `interrupted`) while guaranteeing clean task cancellation (`send_audio_task`, `send_text_task`, `receive_task`) in `finally:` blocks.
- **Translation Specific Configuration**:
  ```python
  client = genai.Client(vertexai=True, project=settings.gcp_project_id, location="global")
  config = types.LiveConnectConfig(
      response_modalities=[types.Modality.AUDIO],
      speech_config=types.SpeechConfig(
          voice_config=types.VoiceConfig(
              prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
          )
      ),
      input_audio_transcription=types.AudioTranscriptionConfig(),
      output_audio_transcription=types.AudioTranscriptionConfig(),
      translation_config=types.TranslationConfig(
          target_language_code="en", echo_target_language=False
      ),
      realtime_input_config=types.RealtimeInputConfig(
          turn_coverage="TURN_INCLUDES_ONLY_ACTIVITY"
      ),
  )
  ```

#### [`src/translator/config.py`](file:///home/xinronglin/projects/wedding-translator/src/translator/config.py)
Streamlined application configuration:
- `gcp_project_id`: `ktzdeir-agbg-anz-gemini-vertex`
- `gcp_location`: `global` (Vertex AI Live Translate preview location)
- `live_model`: `gemini-3.5-live-translate-preview`
- `target_language`: `en`
- `enable_audio_stream`: `False` (audio toggle for guest earbuds)

#### [`src/translator/server.py`](file:///home/xinronglin/projects/wedding-translator/src/translator/server.py)
Lightweight FastAPI server:
- `/ws/speaker`: Ingests binary 16kHz PCM audio frames from the speaker's microphone; feeds `live_translator.send_audio()`.
- `/ws/subtitles`: Broadcasts JSON events to all connected clients:
  - `interim`: Live Chinese draft + English draft preview as tokens arrive.
  - `final`: Completed bilingual sentence segment (`id`, `chinese`, `english`, `timestamp`).
  - `audio_level`: RMS meter updates (0–100%) for microphone visualizer.
  - `audio_chunk`: Base64 24kHz audio (when audio streaming is toggled on).
- `/api/health`: Health status of the server and Gemini Live connection.
- `/api/transcript/export`: Download the full bilingual wedding transcript in Markdown / CSV.
- `/` & `/test`: Serves the self-contained test console.

---

### 2. Frontend Viewports

#### Primary Subtitle Screen (`/` or `/projector`)
- Fullscreen, high-contrast, distraction-free typography for the venue projector / LED wall.
- **Active Subtitle Spotlight**: Latest sentence in large, crisp champagne gold font (36px–48px).
- **Recent Context**: Previous 2 sentences fading gently above.
- Bilingual mode (Chinese original on top, English below) or English-only toggle.

#### Mobile Guest View (`/mobile`)
- Mobile-optimized view accessible via venue QR code.
- Lets non-Chinese-speaking guests read live translated speech on their phones.
- Optional headphone toggle to listen to the synthesized English voice stream.

#### Operator & Testing Console (`/test`)
- Real-time microphone VU meter.
- Live Chinese transcription preview vs. live English translation preview.
- Latency tracker and transcript export button.

---

## Phased Implementation Steps

### Phase 1: Core Gemini Live Engine (Current Step)
- [x] Verify Vertex AI Live API connection to `gemini-3.5-live-translate-preview` with `location='global'`.
- [ ] Implement `src/translator/live_translate.py` with session lifecycle, audio sending, and async response parsing.
- [ ] Update `src/translator/server.py` to route `/ws/speaker` directly to `GeminiLiveTranslator` and broadcast bilingual transcripts to `/ws/subtitles`.
- [ ] Update `src/translator/config.py` to simplify settings.

### Phase 2: Live Verification with Microphone
- [ ] Update `src/translator/static/test.html` to display live Gemini Live interim & final bilingual streams.
- [ ] Test live speaking through laptop microphone to verify Chinese transcription and English subtitle output in real-time.
- [ ] Add automated unit tests in `tests/test_live_translate.py`.

### Phase 3: Production Frontend & Subtitle Views
- [ ] Clean up projector screen and mobile guest page.
- [ ] Add QR code sharing for guests.
- [ ] Verify transcript export (Markdown / CSV).
