import json
from datetime import datetime, timezone
from typing import Any

try:
    from src.models import SpeakerLogEntry
    from src.services.dynamodb import get_dynamodb_table
except ModuleNotFoundError:  # pragma: no cover - fallback for script execution
    from models import SpeakerLogEntry
    from services.dynamodb import get_dynamodb_table


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
        if "AccessDeniedException" in str(exc):
            try:
                fallback_table = get_dynamodb_table(logger)
                if fallback_table is not None:
                    fallback_table.put_item(Item=SpeakerLogEntry.convert_model_to_db_object(entry))
                    logger.warning(
                        "Speaker log write denied for topic=%s; saved to fallback table=%s",
                        topic,
                        fallback_table.table_name,
                    )
                    return
            except Exception as fallback_exc:
                logger.warning(
                    "Speaker log fallback write failure for topic=%s: %s",
                    topic,
                    fallback_exc,
                )

        logger.warning("Speaker log write failure for topic=%s: %s", topic, exc)
