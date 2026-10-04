import json
from datetime import datetime, timezone
from typing import Any

try:
    from src.models import SpeakerLogEntry
except ModuleNotFoundError:  # pragma: no cover - fallback for script execution
    from models import SpeakerLogEntry


def handle_speaker_log_message(logger: Any, topic: str, payload: str) -> None:
    try:
        payload_data = json.loads(payload)
    except json.JSONDecodeError:
        payload_data = {"raw": payload}

    entry = SpeakerLogEntry(
        topic=topic,
        timestamp=datetime.now(timezone.utc),
        payload=payload_data,
        raw_message=payload,
        message_id=None,
    )

    try:
        entry.save()
        logger.info("Speaker log saved to DynamoDB for topic=%s", topic)
    except Exception as exc:  # pragma: no cover - runtime dependency path
        logger.warning("Speaker log write failure for topic=%s: %s", topic, exc)
