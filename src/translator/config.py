"""Configuration models and environment settings for the Wedding Translator."""

from pathlib import Path

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
        default="global",
        alias="GOOGLE_CLOUD_LOCATION",
        description="Vertex AI location for Gemini Live (live-translate is served from 'global')",
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

    # Dedicated simultaneous-translation Live model (listens while it translates)
    live_model: str = Field(
        default="gemini-3.5-live-translate-preview",
        alias="LIVE_MODEL",
        description="Gemini Live model used for 1-step real-time streaming translation",
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

    echo_target_language: bool = Field(
        default=True,
        alias="ECHO_TARGET_LANGUAGE",
        description="Whether to echo/parrot input speech already in the target language (e.g. English code-switching)",
    )
    enable_audio_broadcast: bool = Field(
        default=False,
        alias="ENABLE_AUDIO_BROADCAST",
        description="Whether to broadcast translated 24kHz synthesized audio frames to audience subscribers",
    )

    # Wedding Context
    wedding: WeddingContext = Field(default_factory=WeddingContext)

    # Server Runtime
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    reload: bool = Field(default=False, alias="RELOAD")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")


settings = Settings()
