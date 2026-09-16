import logging

from translator.config import settings

NOSIY_LIB = ["google", "urllib3", "grpc", "httpcore", "httpx"]


def setup_logging(level: str | None = None):
    effective_level = (level or settings.log_level).upper()

    logging.basicConfig(
        level=effective_level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        force=True,  # overwrite any prior basicConfig handlers
    )
    for nosiy_lib in NOSIY_LIB:
        logging.getLogger(nosiy_lib).setLevel(logging.WARNING)
