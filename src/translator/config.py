"""Configuration models and environment settings for the Wedding Translator."""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class AudioConfig(BaseModel):
    """Audio specification for microphone capture and speech streaming."""

    sample_rate: int = Field(
        default=16000, description="Sampling rate in Hz (16kHz recommended for STT)"
    )
    channels: int = Field(default=1, description="Number of audio channels (1 = mono)")
    bytes_per_sample: int = Field(
        default=2, description="16-bit linear PCM has 2 bytes per sample"
    )
    chunk_duration_ms: int = Field(
        default=50,
        description="Duration in ms of each audio frame sent over WebSocket",
    )

    @property
    def chunk_size_bytes(self) -> int:
        """Expected byte size of one audio frame (e.g., 16000 * 0.05 * 2 = 1600 bytes)."""
        return int(
            self.sample_rate * (self.chunk_duration_ms / 1000.0) * self.bytes_per_sample
        )


class WeddingContext(BaseSettings):
    """Contextual metadata injected into Gemini for wedding-specific translation."""

    model_config = SettingsConfigDict(
        env_file=ROOT.joinpath(".env").as_posix(),
        env_file_encoding="utf-8",
        extra="ignore",
        env_prefix="WEDDING_",
        populate_by_name=True,
    )

    bride_name: str = Field(
        default="Joy", description="Bride's name (and Chinese name if applicable)"
    )
    groom_name: str = Field(
        default="Xinrong", description="Groom's name (and Chinese name if applicable)"
    )
    venue: str = Field(
        default="Stones of the Yarra Valley",
        description="Wedding ceremony and reception venue",
    )
    speaker_role: str = Field(
        default="",
        description="Relationship/Role of the speaker (e.g. 'Best Man', 'Maid of Honor')",
    )
    custom_notes: str = Field(
        default="",
        description="Special names, family terms, or tone instructions",
    )
    custom_vocabulary: str = Field(
        default="",
        description="Comma-separated custom vocabulary words for speech recognition biasing",
    )

    def get_vocabulary_list(self) -> list[str]:
        """Generate vocabulary biasing list for Chinese speech recognition and homophone disambiguation."""
        vocab: list[str] = [
            # Key wedding terms, blessings & roles
            "百年好合",
            "新婚快乐",
            "新郎",
            "新娘",
            "伴郎",
            "伴娘",
            "司仪",
            "各位来宾",
            "亲朋好友",
            "致辞",
            "干杯",
            "Cheers",
        ]

        if self.bride_name:
            for item in self.bride_name.replace(",", " ").split():
                clean = item.strip()
                if clean and clean not in vocab:
                    vocab.append(clean)
        if self.groom_name:
            for item in self.groom_name.replace(",", " ").split():
                clean = item.strip()
                if clean and clean not in vocab:
                    vocab.append(clean)
        if self.venue:
            for loc in [
                self.venue,
                "Stones of the Yarra Valley",
                "Yarra Valley",
                "Coldstream",
                "雅拉河谷",
            ]:
                if loc not in vocab:
                    vocab.append(loc)
        if self.speaker_role and self.speaker_role not in vocab:
            vocab.append(self.speaker_role)
        if self.custom_vocabulary:
            for item in self.custom_vocabulary.split(","):
                clean = item.strip()
                if clean and clean not in vocab:
                    vocab.append(clean)
        return vocab


def build_wedding_translation_instruction(ctx: WeddingContext | None = None) -> str:
    """Build system instruction for Gemini 3.8 Live 1-step real-time speech translation."""
    c = ctx or WeddingContext()
    context_lines = [
        f"- Groom: {c.groom_name} (Chinese: 欣荣 / 林欣荣)",
        f"- Bride: {c.bride_name} (Chinese: 顺顺 / 赵雪)",
        f"- Venue: {c.venue}",
    ]
    if c.speaker_role:
        context_lines.append(f"- Speaker Role: {c.speaker_role}")
    if c.custom_notes:
        context_lines.append(f"- Special Notes & Tone: {c.custom_notes}")

    instructions = [
        "You are an expert real-time simultaneous speech-to-English subtitle translator for a wedding ceremony.",
        "Your mission: Listen to the incoming speech and immediately translate what is spoken into natural, fluent English subtitles in real-time.",
        "",
        "CRITICAL GROUNDING & ZERO-HALLUCINATION RULES:",
        "1. TRANSLATE ONLY WHAT IS SPOKEN: Translate strictly and faithfully what the speaker literally says. Do NOT invent, assume, or extrapolate words that were not spoken.",
        "2. NEVER HALLUCINATE CANNED SPEECHES: Under NO circumstances should you output generic ceremonial openings (such as 'Welcome everyone to this beautiful celebration of love' or 'Dear guests, welcome') unless the speaker explicitly utters those exact words.",
        "3. CASUAL, TEST & OFF-HAND SPEECH: If the speaker asks questions, tests the microphone (e.g. 'mic check', 'can you hear me', '这个 translation 是不是有用的问题?'), makes a joke, or speaks off-topic, translate their exact meaning faithfully into English.",
        "4. BILINGUAL CODE-SWITCHING: The speaker may mix English words (e.g., 'translation', 'love', 'cheers') into Chinese sentences. Transcribe and integrate the English naturally into the translated subtitle.",
        "5. WEDDING CONTEXT & NAMES: When names, roles, or wedding blessings are genuinely spoken, translate them accurately and gracefully according to this context:",
        "\n".join(context_lines),
        "6. SUBTITLE FORMAT: Output ONLY English text subtitles. Stream translations with minimal latency, like Google Translate Live. Never output Chinese characters, pinyin, timestamps, quotation marks, or conversational responses.",
    ]

    return "\n".join(instructions)


class Settings(BaseSettings):
    """Application runtime configuration loaded from environment variables and .env."""

    model_config = SettingsConfigDict(
        env_file=ROOT.joinpath(".env").as_posix(),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # Project metadata
    project_name: str = "Joy & Xinrong Wedding Speech Translator"
    version: str = "0.3.0"

    # Google Cloud & Vertex AI
    google_cloud_project: str | None = Field(
        default=None,
        alias="GOOGLE_CLOUD_PROJECT",
        description="Google Cloud Project ID",
    )
    cloud_run_region: str = Field(
        default="australia-southeast2",
        alias="CLOUD_RUN_REGION",
        description="Google Cloud Run deployment region (Melbourne)",
    )
    google_cloud_location: str = Field(
        default="us-central1",
        alias="GOOGLE_CLOUD_LOCATION",
        description="Vertex AI region for Gemini Live (default: us-central1)",
    )
    gemini_api_key: str | None = Field(
        default=None,
        alias="GEMINI_API_KEY",
        description="API key for Gemini (used in AI Studio / personal project)",
    )
    google_genai_use_vertexai: bool | None = Field(
        default=None,
        alias="GOOGLE_GENAI_USE_VERTEXAI",
        description="Whether to use Vertex AI (True) or Google AI Studio (False). None = auto-detect.",
    )
    service_name: str = Field(
        default="wedding-translator",
        alias="SERVICE_NAME",
        description="Cloud Run service name",
    )

    @property
    def use_vertex(self) -> bool:
        """Determine whether to use Vertex AI or Google AI Studio.

        Resolution:
        1. Explicit GOOGLE_GENAI_USE_VERTEXAI environment variable takes precedence.
        2. If project contains 'accenture' or 'vertex' or equals 'ktzdeir-agbg-anz-gemini-vertex', True.
        3. If project is personal ('canvas-aviary-302803') or GEMINI_API_KEY is provided without Vertex, False.
        4. Default to True if a GCP project is configured without API key, else False.
        """
        if self.google_genai_use_vertexai is not None:
            return self.google_genai_use_vertexai
        if self.google_cloud_project:
            proj = self.google_cloud_project.lower()
            if (
                "vertex" in proj
                or "accenture" in proj
                or proj == "ktzdeir-agbg-anz-gemini-vertex"
            ):
                return True
            return not (proj == "canvas-aviary-302803" or bool(self.gemini_api_key))
        return False

    # Access Control (Sign in with Google)
    google_oauth_client_id: str | None = Field(
        default=None,
        alias="GOOGLE_OAUTH_CLIENT_ID",
        description="OAuth 2.0 Web Client ID used to verify 'Sign in with Google' ID tokens before opening /ws/speaker",
    )
    speaker_allowed_emails: str = Field(
        default="405896828.xl@gmail.com",
        alias="SPEAKER_ALLOWED_EMAILS",
        description="Comma-separated Google account emails allowed to start a speaker session",
    )

    @property
    def speaker_allowed_emails_set(self) -> set[str]:
        """Normalized (trimmed, lowercased) set of emails allowed to open /ws/speaker."""
        return {
            e.strip().lower()
            for e in self.speaker_allowed_emails.split(",")
            if e.strip()
        }

    # Gemini 3.8 Live 1-Step Model
    live_model: str = Field(
        default="gemini-3.8-live",
        alias="LIVE_MODEL",
        description="Gemini 3.8 Live 1-step real-time streaming translation model",
    )

    source_language_description: str = Field(
        default="Mandarin Chinese (Simplified) with mixed English code-switching",
        alias="SOURCE_LANGUAGE_DESCRIPTION",
        description="Description of spoken input languages",
    )
    target_language: str = Field(
        default="en",
        alias="TARGET_LANGUAGE",
        description="Target translation language code (BCP-47) - always English",
    )

    # Speech-to-Text & Inference Tuning
    stt_language_codes: str = Field(
        default="zh-CN,en-US",
        alias="STT_LANGUAGE_CODES",
        description="Comma-separated BCP-47 language codes for speech recognition",
    )
    stt_mode: Literal["SMART", "VERBATIM"] = Field(
        default="SMART",
        alias="STT_MODE",
        description="Speech recognition mode: SMART (neural cleanup) or VERBATIM",
    )
    temperature: float = Field(
        default=0.0,
        alias="TEMPERATURE",
        description="Sampling temperature for translation determinism (0.0 = maximum acoustic grounding)",
    )
    echo_target_language: bool = Field(
        default=True,
        alias="ECHO_TARGET_LANGUAGE",
        description="Whether to echo/parrot input speech already in the target language (e.g. English code-switching)",
    )
    enable_context_compression: bool = Field(
        default=True,
        alias="ENABLE_CONTEXT_COMPRESSION",
        description="Enable sliding-window context compression to remove the 15-minute uncompressed session limit",
    )
    enable_session_resumption: bool = Field(
        default=True,
        alias="ENABLE_SESSION_RESUMPTION",
        description="Enable automatic session resumption tokens to survive socket drops",
    )
    enable_audio_broadcast: bool = Field(
        default=False,
        alias="ENABLE_AUDIO_BROADCAST",
        description="Whether to broadcast translated 24kHz synthesized audio frames to audience subscribers",
    )
    vad_silence_duration_ms: int = Field(
        default=240,
        alias="VAD_SILENCE_DURATION_MS",
        description="Voice activity detection silence threshold in milliseconds for snappy turn detection",
    )

    # Wedding Context
    wedding: WeddingContext = Field(default_factory=WeddingContext)

    # Server Runtime
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    reload: bool = Field(default=False, alias="RELOAD")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")


settings = Settings()
