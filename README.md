# Wedding Speech Translator

A lightweight, low-latency, real-time speech translation web service designed specifically for wedding ceremonies and banquets.

It interprets spoken **Mandarin Chinese (Simplified)**—including natural **English code-switching** (mixed English words, phrases, and personal names)—and streams **fluent English subtitles** in real time.

Built on Google's **Gemini Live Translate** model (`gemini-3.5-live-translate-preview`) through the Google GenAI Python SDK (`google-genai`). The session setup follows Google's [Live Translate guide](https://ai.google.dev/gemini-api/docs/live-api/live-translate) and its reference client ([`translate.py`](https://github.com/google-gemini/gemini-live-api-examples/blob/main/command-line/python/translate.py)): no prompt, no vocabulary or VAD tuning, 100 ms audio chunks, and a fresh session whenever the server ends one.

The Live model's own English is simultaneous interpretation: it commits before a Chinese sentence is over, chains sentences with commas, and only knows the names it hears. So the subtitles are built from its Chinese transcript instead. Each short clause is re-translated by a text model (`REFINE_MODEL`, default `gemini-3.5-flash` without thinking) that sees the previous subtitles and the couple's names. On a 3-minute test speech, a blind judge scored this 92–96/100, against 65/100 for the Live English. The English appears ~1.5 s after its Chinese.

---

## Architecture Overview

```
+---------------------------------------------------------------------------------+
|                            Wedding Speaker Microphone                           |
|                      Web Audio API (Browser) - 16kHz Mono PCM                   |
+----------------------------------------+----------------------------------------+
                                         |
                                         v WebSocket (/ws/speaker or /ws)
+---------------------------------------------------------------------------------+
|                          FastAPI Asynchronous Gateway                           |
|                                                                                 |
|   Audio Ingestion Bridge                         Broadcast Hub                  |
|   - Ingests 16kHz PCM, sends 100 ms chunks       - Pushes live English          |
|   - Cuts the Chinese transcript into short         subtitles to Projector,      |
|     subtitles (SubtitleSegmenter)                  Mobile, & Console Displays   |
|   - Re-translates each with context + names        (/ws/subtitles)              |
|     (TranslationRefiner, gemini-3.5-flash)                                      |
+----------------------------------------+----------------------------------------+
                                         |
                         Bidirectional   |   Real-time Audio In
                            WebSocket    |   Simultaneous Translated Tokens Out
                                         v
+---------------------------------------------------------------------------------+
|                         Google Gemini Live Translate                            |
|                  Model: gemini-3.5-live-translate-preview                       |
|              Backend: Vertex AI (location 'global') or AI Studio                |
|                                                                                 |
|   - Continuous simultaneous interpretation (no turns, listens while it talks)   |
|   - Source transcript (input) + English transcript (output) streamed back      |
+---------------------------------------------------------------------------------+
```

---

## Quickstart

### 1. Prerequisites & GCP Authentication
Ensure you have Google Cloud SDK installed and authenticated with Application Default Credentials (ADC):
```bash
gcloud auth application-default login
gcloud config set project canvas-aviary-302803
```

### 2. Installation
Install dependencies using [`uv`](https://docs.astral.sh/uv/):
```bash
uv sync
```

### 3. Start the Application
Run the services:
```bash
make app-up
```
- Backend (FastAPI + WebSockets): [http://localhost:8000/](http://localhost:8000/)
- Frontend (Vite Dev Server): [http://localhost:5173/](http://localhost:5173/)

To stop all services:
```bash
make app-down
```

### 4. Interactive Testing
1. Click **"Start Microphone"** and allow browser microphone access.
2. Speak Mandarin Chinese into your microphone (e.g. *"今天来到这里，看到 Joy 和 Xinrong 这么 happy，真的非常 touch..."*).
3. Watch the live simultaneous stream:
   - **Input**: Transcribed Chinese with mixed English.
   - **Output**: Pure, natural English subtitles.
4. Export the complete transcript anytime in Markdown or CSV from the UI.

---

## Frontend Application (`src/app`)

Built with **React 19**, **TypeScript**, and **Tailwind CSS v4** via **Vite**, the frontend delivers responsive, low-latency UI across three specialized viewports:

1. **Projector Mode (`/projector` or `/#projector`)**:
   - Designed for venue 1080p / 4K projection and LED stage walls.
   - **Active Spotlight**: Massive Champagne Gold English subtitles (`text-6xl`) with subtle ambient glow.
   - **Context Cascade**: Preceding sentences fade softly above for seamless reading.
   - **Controls**: Press <kbd>F</kbd> for fullscreen, toggle Bilingual / English-only mode, and adjust font sizes.

2. **Speaker & Admin Console (`/speaker` or `/#speaker`)**:
   - Web Audio API microphone capture downsampling dynamically to 16,000 Hz 16-bit linear PCM.
   - Real-time animated VU energy meter (RMS level).
   - Live side-by-side feed comparing spoken Chinese (+ mixed English) vs translated English.
   - Single-click transcript export (Markdown / CSV) and clear session controls.

3. **Mobile Guest View (`/mobile` or `/#mobile`)**:
   - Lightweight, mobile-first feed optimized for banquet guests following on smartphones via venue QR code.
   - Auto-scroll lock toggle, font scaling, and native link sharing.

---

## Development & Build Commands

```bash
# Setup & Installation
make install          # Install both backend (uv) and frontend (npm) dependencies

# Running Services
make app-up           # Start both backend (port 8000) and frontend (port 5173) concurrently
make app-down         # Stop both backend and frontend processes (ports 8000 & 5173)
make docker-up        # Build and run containerized application via Docker Compose (port 8080)
make docker-down      # Stop Docker Compose containers

# Build & Quality
make build            # Compile React TypeScript frontend into src/app/dist
make test             # Run backend pytest suite (or `make test SMOKE=1`)
make lint             # Run ruff checks
make format           # Format code
make check            # Run both lint checks and test suite

# Cloud Run Deployment
make deploy           # Build container image and deploy directly to Google Cloud Run
make allow            # Grant Cloud Run invoker role (default: current user, PUBLIC=1 for allUsers)
make proxy            # Open local proxy to Cloud Run service (port 8080)
```

---

## Google Cloud Run Deployment

The project includes a multi-stage `Dockerfile` that packages both the compiled React frontend (`src/app/dist`) and the Python 3.13 FastAPI backend into a single container.

The service is deployed with `--allow-unauthenticated` so wedding guests can open the projector/mobile pages directly without a Google login. The only endpoint that actually starts a (billable) Gemini Live session, `/ws/speaker`, is gated separately by `SPEAKER_ACCESS_KEY` in `.env` — set that to a private value before deploying, and give it only to whoever runs the mic.

### Deploying via Makefile
```bash
make deploy
```
*(Optionally override project or region: `make deploy GOOGLE_CLOUD_PROJECT=my-project CLOUD_RUN_REGION=australia-southeast1`)*

### Deploying via `gcloud` CLI directly
```bash
gcloud run deploy wedding-translator \
    --source . \
    --project canvas-aviary-302803 \
    --region australia-southeast2 \
    --allow-unauthenticated \
    --timeout 3600 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 1 \
    --concurrency 250 \
    --no-cpu-throttling \
    --port 8080 \
    --env-vars-file .env
```

> [!TIP]
> - **WebSocket Streaming**: `--timeout 3600` ensures live audio WebSocket sessions are not prematurely interrupted by Cloud Run's default 5-minute timeout.
> - **Vertex AI Authentication**: Running on Cloud Run within the project leverages IAM Application Default Credentials (ADC) automatically—no API key secrets required.

