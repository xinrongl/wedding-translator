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
            # High-frequency wedding blessings & idioms
            "百年好合",
            "白头偕老",
            "早生贵子",
            "永结同心",
            "花好月圆",
            "新婚快乐",
            "佳偶天成",
            "天作之合",
            "相濡以沫",
            "携手并肩",
            "鸾凤和鸣",
            "心心相印",
            "喜结连理",
            "情比金坚",
            "互敬互爱",
            "美满幸福",
            # Ceremony roles & terms
            "新郎",
            "新娘",
            "伴郎",
            "伴娘",
            "主婚人",
            "证婚人",
            "司仪",
            "岳父",
            "岳母",
            "公公",
            "婆婆",
            "各位来宾",
            "亲朋好友",
            "致辞",
            "敬酒",
            "交杯酒",
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
                "墨尔本",
                "Melbourne",
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
        "You are an expert real-time English subtitle translator for a bilingual wedding ceremony.",
        "Your mission: Listen to the incoming spoken audio (spoken in Chinese, occasionally mixed with English) and immediately stream natural, elegant, fluent English subtitles in real-time as the speaker talks.",
        "",
        "Core Translation Rules:",
        "1. Output ONLY English text subtitles. Never output Chinese characters, pinyin, phonetic guides, quotation marks, or meta comments.",
        "2. Stream translations with minimal latency — output translated English words as soon as you hear each clause, just like Google Translate Live.",
        "3. When Chinese is spoken: Translate directly into natural, heartfelt, and grammatically graceful English.",
        "4. When English is spoken (code-switching): Transcribe and refine the English directly without translating it back to Chinese.",
        "5. Accurately translate traditional Chinese wedding blessings, idioms, and heartfelt sentiments into poetic, graceful English (e.g., '百年好合' -> 'A lifetime of love and harmony', '白头偕老' -> 'Growing old together in love', '永结同心' -> 'Hearts joined forever in love', '新婚快乐' -> 'Happy wedding day').",
        "6. Preserve proper names, roles, and locations accurately according to the Wedding Context below:",
        "\n".join(context_lines),
        "7. Keep subtitles concise, expressive, and immediately readable on a projector screen for wedding guests.",
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
            if "vertex" in proj or "accenture" in proj or proj == "ktzdeir-agbg-anz-gemini-vertex":
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
        return {e.strip().lower() for e in self.speaker_allowed_emails.split(",") if e.strip()}

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
        default=0.2,
        alias="TEMPERATURE",
        description="Sampling temperature for translation determinism",
    )

    # Wedding Context
    wedding: WeddingContext = Field(default_factory=WeddingContext)

    # Server Runtime
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    reload: bool = Field(default=False, alias="RELOAD")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")


settings = Settings()
