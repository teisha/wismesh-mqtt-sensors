import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from boto3.dynamodb.conditions import Key

try:
    from src.services.dynamodb import DynamoDBConvertible, get_dynamodb_table
except ModuleNotFoundError:  # pragma: no cover - fallback for script execution
    from services.dynamodb import DynamoDBConvertible, get_dynamodb_table


@dataclass
class GardenTelemetryRecord(DynamoDBConvertible):
    """Represents a single sensor reading preserved in DynamoDB."""

    sender: str
    channel: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    temperature: Optional[str] = None
    humidity: Optional[str] = None
    pressure: Optional[str] = None
    iaq: Optional[int] = None
    gas_res: Optional[str] = None
    lux: Optional[int] = None

    @staticmethod
    def _normalize_datetime(value: Any) -> datetime:
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
    def convert_db_object_to_model(cls, db_object: Dict[str, Any]) -> "GardenTelemetryRecord":
        node_id = db_object.get("node_id") or db_object.get("PK", "").replace("NODE#", "")
        search_attr = db_object.get("search_attribute") or ""
        channel_value = db_object.get("channel_index")
        if channel_value is None and search_attr.startswith("CHANNEL#"):
            channel_value = search_attr.replace("CHANNEL#", "")

        return cls(
            sender=node_id,
            channel=str(channel_value) if channel_value is not None else "",
            timestamp=cls._normalize_datetime(db_object.get("timestamp")),
            temperature=db_object.get("temperature"),
            humidity=db_object.get("humidity"),
            pressure=db_object.get("pressure"),
            iaq=db_object.get("iaq"),
            gas_res=db_object.get("gas_res"),
            lux=db_object.get("lux"),
        )

    @classmethod
    def convert_model_to_db_object(cls, model: "GardenTelemetryRecord") -> Dict[str, Any]:
        timestamp_value = model.timestamp
        if not isinstance(timestamp_value, datetime):
            timestamp_value = datetime.now(timezone.utc)

        return {
            "PK": f"NODE#{model.sender}",
            "SK": f"TS#{cls._to_iso8601(timestamp_value)}",
            "search_attribute": f"CHANNEL#{model.channel}",
            "node_id": model.sender,
            "timestamp": cls._to_iso8601(timestamp_value),
            "channel_index": model.channel,
            "temperature": model.temperature,
            "humidity": model.humidity,
            "pressure": model.pressure,
            "iaq": model.iaq,
            "gas_res": model.gas_res,
            "lux": model.lux,
        }

    @classmethod
    def create_from_db_object(cls, db_object: Dict[str, Any]) -> "GardenTelemetryRecord":
        return cls.convert_db_object_to_model(db_object)

    def save(self) -> None:
        db_table = get_dynamodb_table(logging.getLogger(__name__))
        if db_table is None:
            raise RuntimeError("DynamoDB table is unavailable for GardenTelemetryRecord.save()")
        db_table.put_item(Item=self.convert_model_to_db_object(self))

    @classmethod
    def get_by_sender_and_channel(cls, sender: str, channel: str) -> list["GardenTelemetryRecord"]:
        db_table = get_dynamodb_table(logging.getLogger(__name__))
        if db_table is None:
            return []

        response = db_table.query(
            IndexName="SearchIndex",
            KeyConditionExpression=Key("search_attribute").eq(f"CHANNEL#{channel}"),
        )

        items = [item for item in response.get("Items", []) if item.get("node_id") == sender]
        return [cls.create_from_db_object(item) for item in items]
