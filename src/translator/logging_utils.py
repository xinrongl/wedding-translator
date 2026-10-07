"""Logging configuration for the Wedding Translator service."""

import logging

from translator.config import settings

NOISY_LIBS = ["google", "urllib3", "grpc", "httpcore", "httpx"]


def setup_logging(level: str | None = None) -> None:
    """Configure application-wide structured console logging."""
    effective_level = (level or settings.log_level).upper()

    logging.basicConfig(
        level=effective_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
        force=True,
    )
    for lib in NOISY_LIBS:
        logging.getLogger(lib).setLevel(logging.WARNING)
