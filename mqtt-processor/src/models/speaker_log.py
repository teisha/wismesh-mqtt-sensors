import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from boto3.dynamodb.conditions import Key

try:
    from src.services.dynamodb import DynamoDBConvertible, get_speaker_logging_service
except ModuleNotFoundError:  # pragma: no cover - fallback for script execution
    from services.dynamodb import DynamoDBConvertible, get_speaker_logging_service


@dataclass
class SpeakerLogEntry(DynamoDBConvertible):
    """Represents a raw MQTT message stored under a topic partition key."""

    topic: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    payload: Dict[str, Any] = field(default_factory=dict)
    raw_message: Optional[str] = None
    message_id: Optional[str] = None

    @staticmethod
    def _normalize_timestamp(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            cleaned = value.replace("Z", "+00:00")
            try:
                return datetime.fromisoformat(cleaned)
            except ValueError:
                return datetime.now(timezone.utc)
        return datetime.now(timezone.utc)

    @staticmethod
    def _to_iso8601(value: Any) -> str:
        if isinstance(value, datetime):
            return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        return str(value)

    @classmethod
    def convert_db_object_to_model(cls, db_object: Dict[str, Any]) -> "SpeakerLogEntry":
        raw_payload = db_object.get("payload", {})
        if isinstance(raw_payload, str):
            try:
                payload = json.loads(raw_payload)
            except json.JSONDecodeError:
                payload = {"raw": raw_payload}
        else:
            payload = raw_payload or {}

        return cls(
            topic=(db_object.get("PK") or "").replace("TOPIC|", ""),
            timestamp=cls._normalize_timestamp(db_object.get("SK")),
            payload=payload,
            raw_message=db_object.get("raw_message"),
            message_id=db_object.get("message_id"),
        )

    @classmethod
    def convert_model_to_db_object(cls, model: "SpeakerLogEntry") -> Dict[str, Any]:
        timestamp_value = model.timestamp
        if not isinstance(timestamp_value, datetime):
            timestamp_value = datetime.now(timezone.utc)

        return {
            "PK": f"TOPIC|{model.topic}",
            "SK": cls._to_iso8601(timestamp_value),
            "timestamp": cls._to_iso8601(timestamp_value),
            "payload": model.payload,
            "raw_message": model.raw_message,
            "message_id": model.message_id,
        }

    @classmethod
    def create_from_db_object(cls, db_object: Dict[str, Any]) -> "SpeakerLogEntry":
        return cls.convert_db_object_to_model(db_object)

    def save(self) -> None:
        service = get_speaker_logging_service(logging.getLogger(__name__))
        service.put_item(self.convert_model_to_db_object(self))

    @classmethod
    def get_by_topic_range(
        cls,
        topic: str,
        start_time: datetime,
        end_time: datetime,
    ) -> List["SpeakerLogEntry"]:
        service = get_speaker_logging_service(logging.getLogger(__name__))
        start_iso = cls._to_iso8601(start_time)
        end_iso = cls._to_iso8601(end_time)

        response = service._table.query(
            KeyConditionExpression=(
                Key("PK").eq(f"TOPIC|{topic}") &
                Key("SK").between(start_iso, end_iso)
            )
        )
        return [cls.create_from_db_object(item) for item in response.get("Items", [])]

    def __repr__(self) -> str:
        return (
            f"SpeakerLogEntry(topic={self.topic!r}, timestamp={self.timestamp.isoformat()}, "
            f"payload={self.payload!r})"
        )
