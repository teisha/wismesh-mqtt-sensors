import logging
import os
from logging.handlers import RotatingFileHandler


def setup_logger(logger_name: str = "garden_telemetry") -> logging.Logger:
    src_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app_dir = os.path.dirname(src_dir)

    log_file = os.getenv("LOG_FILE", os.path.join(app_dir, "app.log"))
    log_max_bytes = int(os.getenv("LOG_MAX_BYTES", 1_048_576))
    log_backup_count = int(os.getenv("LOG_BACKUP_COUNT", 5))
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()

    logger = logging.getLogger(logger_name)
    logger.setLevel(getattr(logging, log_level, logging.INFO))

    if logger.handlers:
        return logger

    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    if log_file:
        log_dir = os.path.dirname(log_file)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
        rotating_handler = RotatingFileHandler(
            log_file,
            maxBytes=log_max_bytes,
            backupCount=log_backup_count,
        )
        rotating_handler.setFormatter(formatter)
        logger.addHandler(rotating_handler)

    return logger
