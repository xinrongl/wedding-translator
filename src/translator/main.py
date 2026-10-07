"""CLI entrypoint for the Wedding Speech Translator server."""

import logging

import uvicorn

from translator.config import settings
from translator.logging_utils import setup_logging

logger = logging.getLogger(__name__)


def main():
    """Start the Wedding Translator FastAPI server."""
    logger.info("=" * 60)
    logger.info("Wedding Speech Real-time Translator (Gemini 3.8 Live API)")
    logger.info(
        f"GCP Project: {settings.google_cloud_project} (Location: {settings.google_cloud_location})"
    )
    backend_name = "Vertex AI" if settings.use_vertex else "Google AI Studio (Gemini Developer API)"
    logger.info(f"Backend Engine: {backend_name} (use_vertex={settings.use_vertex})")
    logger.info(f"Live Translation Model: {settings.live_model} (1-Step Streaming)")
    logger.info(f"Input Speech: {settings.source_language_description}")
    logger.info(f"Target Subtitles: English ({settings.target_language})")
    logger.info(
        f"Wedding Couple: {settings.wedding.groom_name} & {settings.wedding.bride_name}"
    )
    logger.info(f"Local App URL: http://localhost:{settings.port} (use localhost for mic permission)")
    logger.info(f"Bind Address:  http://{settings.host}:{settings.port}")
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
