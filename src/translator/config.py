"""Configuration settings and data models for the Wedding Translator."""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).parent.parent.parent


class AudioConfig(BaseModel):
    """Audio specification for microphone capture and Speech-to-Text streaming."""

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
        """Expected byte size of one audio frame (e.g., 16000 * 0.1 * 2 = 3200 bytes)."""
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
        description="Relationship/Role of the speaker (e.g., 'Father of the Bride', 'Best Man', 'Maid of Honor')",
    )
    custom_notes: str = Field(
        default="",
        description="Special names, family terms, or tone instructions (e.g. 'Uncle Zhang', 'warm and humorous')",
    )
    custom_vocabulary: str = Field(
        default="",
        description="Comma-separated custom vocabulary words or phonetic hints for speech recognition biasing",
    )

    def get_vocabulary_list(self) -> list[str]:
        """Generate comprehensive vocabulary biasing list for Chinese speech recognition and homophone disambiguation."""
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
            # Wedding ceremony roles & terms
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
        if getattr(self, "venue", None):
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
    """Build system instruction for the LLM text translation step in the two-step pipeline."""
    c = ctx or WeddingContext()
    context_lines = [
        f"Groom: {c.groom_name}",
        f"Bride: {c.bride_name}",
        f"Venue: {c.venue}",
        "欣荣: Xinrong",
        "顺顺: Joy",
    ]
    if c.speaker_role:
        context_lines.append(f"Speaker Role: {c.speaker_role}")
    if c.custom_notes:
        context_lines.append(f"Context Notes: {c.custom_notes}")

    instructions = [
        "You are an expert real-time English subtitle translator for a bilingual wedding ceremony.",
        "Your task: Translate spoken Chinese wedding speech into natural, elegant, fluent English subtitles.",
        "",
        "Guidelines:",
        "1. Output ONLY the English translation. Never output Chinese, explanations, notes, pinyin, or quotation marks.",
        "2. Accurately translate traditional Chinese wedding blessings, idioms, and heartfelt sentiments into poetic, graceful English.",
        "3. Preserve proper names, places, and embedded English words exactly as spoken. Wedding Context below:",
        "\n".join(context_lines),
        "4. Keep the translation concise, expressive, and immediately readable for a live audience.",
    ]

    return "\n".join(instructions)


# Backward-compatible alias
build_wedding_system_instruction = build_wedding_translation_instruction


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
    version: str = "0.2.0"

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
        default="global",
        alias="GOOGLE_CLOUD_LOCATION",
        description="Vertex AI region (default: global)",
    )
    gemini_api_key: str | None = Field(
        default=None,
        alias="GEMINI_API_KEY",
        description="API key for Gemini (optional when using ADC on Vertex AI)",
    )
    service_name: str = Field(
        default="wedding-translator",
        alias="SERVICE_NAME",
        description="Cloud Run service name",
    )

    # Access Control
    speaker_access_key: str | None = Field(
        default=None,
        alias="SPEAKER_ACCESS_KEY",
        description="Shared secret required to open /ws/speaker and start a Gemini Live session (unset = no gate)",
    )

    # Two-Step Pipeline Models (Gemini 3.5 Transcribe Live + Gemini 2.5 Flash)
    transcribe_model: str = Field(
        default="gemini-3.5-transcribe-live-preview",
        alias="TRANSCRIBE_MODEL",
        description="Gemini 3.5 Transcribe streaming ASR model",
    )
    translation_model: str = Field(
        default="gemini-3.5-flash",
        alias="TRANSLATION_MODEL",
        description="Fast LLM translation model for Chinese-to-English wedding subtitles",
    )
    translation_thinking_budget: int = Field(
        default=0,
        alias="TRANSLATION_THINKING_BUDGET",
        description="Thinking token budget for translation (0 = ultra-low latency direct translation)",
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
    enable_live_audio_stream: bool = Field(
        default=False,
        alias="ENABLE_LIVE_AUDIO_STREAM",
        description="Broadcast synthesized 24kHz English speech audio",
    )

    # Speech-to-Text & Inference Tuning
    stt_language_codes: str = Field(
        default="zh-CN,en-US",
        alias="STT_LANGUAGE_CODES",
        description="Comma-separated BCP-47 language codes for speech recognition (or 'auto' for auto-detect)",
    )
    stt_mode: Literal["SMART", "VERBATIM"] = Field(
        default="SMART",
        alias="STT_MODE",
        description="Speech recognition transcription mode: SMART (neural cleanup) or VERBATIM",
    )
    temperature: float = Field(
        default=0.2,
        alias="TEMPERATURE",
        description="Sampling temperature for translation and recognition determinism",
    )

    # Sub-configurations
    audio: AudioConfig = Field(default_factory=AudioConfig)
    wedding: WeddingContext = Field(default_factory=WeddingContext)

    # Server Host & Port
    host: str = Field(default="0.0.0.0", alias="HOST", description="Server bind host")
    port: int = Field(default=8000, alias="PORT", description="Server bind port")
    reload: bool = Field(
        default=False, alias="RELOAD", description="Enable auto-reload for development"
    )

    # logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO", alias="LOG_LEVEL", description="Global log level."
    )


# Global singleton settings instance
settings = Settings()
