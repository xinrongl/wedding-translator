"""CLI entrypoint for the Wedding Speech Translator server."""

import logging

import uvicorn

from translator.config import settings
from translator.logging_utils import setup_logging

logger = logging.getLogger(__name__)


def main():
    """Start the Wedding Translator FastAPI server."""
    logger.info("=" * 60)
    logger.info("Wedding Speech Real-time Translator (Gemini Live API)")
    logger.info(
        f"GCP Project: {settings.gcp_project_id} (Location: {settings.gcp_location})"
    )
    logger.info(f"Live ASR Model: {settings.transcribe_model}")
    logger.info(f"Translation Model: {settings.translation_model}")
    logger.info(f"Input Speech: {settings.source_language_description}")
    logger.info(f"Target Subtitles: English ({settings.target_language})")
    logger.info(
        f"Wedding Couple: {settings.wedding.groom_name} & {settings.wedding.bride_name}"
    )
    logger.info(f"Server URL: http://{settings.host}:{settings.port}")
    logger.info("=" * 60)

    uvicorn.run(
        "translator.server:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )


if __name__ == "__main__":
    setup_logging()
    main()
