import json
from datetime import datetime, timezone
from typing import Any, Dict, Tuple

from prometheus_client import Gauge

try:
    from src.models import GardenTelemetryRecord
    from src.payload_parser import parse_telemetry_message
except ModuleNotFoundError:  # pragma: no cover - fallback for script execution
    from models import GardenTelemetryRecord
    from payload_parser import parse_telemetry_message


def _build_gauges() -> Dict[str, Gauge]:
    labels = ["sender", "channel"]
    return {
        "temperature": Gauge("garden_temperature_celsius", "Temperature in degrees Celsius", labels),
        "humidity": Gauge("garden_humidity_percent", "Relative humidity percentage", labels),
        "pressure": Gauge("garden_pressure_hpa", "Barometric pressure in hPa", labels),
        "iaq": Gauge("garden_iaq_score", "Indoor Air Quality index rating", labels),
        "gas": Gauge("garden_gas_resistance_kohm", "Gas resistance value from sensor", labels),
        "lux": Gauge("garden_light_lux", "Ambient light reading in Lux", labels),
    }


GAUGES = _build_gauges()


def handle_garden_telemetry_message(logger: Any, payload: str, db_table: Any) -> None:
    payload_data = json.loads(payload)
    parsed_message = parse_telemetry_message(payload_data)
    if not parsed_message:
        return

    sender, channel, telemetry = parsed_message

    if "temperature" in telemetry:
        GAUGES["temperature"].labels(sender=sender, channel=channel).set(telemetry["temperature"])
    if "relative_humidity" in telemetry:
        GAUGES["humidity"].labels(sender=sender, channel=channel).set(telemetry["relative_humidity"])
    if "barometric_pressure" in telemetry:
        GAUGES["pressure"].labels(sender=sender, channel=channel).set(telemetry["barometric_pressure"])
    if "iaq" in telemetry:
        GAUGES["iaq"].labels(sender=sender, channel=channel).set(telemetry["iaq"])
    if "gas_resistance" in telemetry:
        GAUGES["gas"].labels(sender=sender, channel=channel).set(telemetry["gas_resistance"])
    if "lux" in telemetry:
        GAUGES["lux"].labels(sender=sender, channel=channel).set(telemetry["lux"])

    logger.info("Local metrics exposed for sender=%s channel=%s", sender, channel)

    if db_table:
        record = GardenTelemetryRecord(
            sender=sender,
            channel=channel,
            timestamp=datetime.now(timezone.utc),
            temperature=str(telemetry.get("temperature")),
            humidity=str(telemetry.get("relative_humidity")),
            pressure=str(telemetry.get("barometric_pressure")),
            iaq=int(telemetry.get("iaq", 0)),
            gas_res=str(telemetry.get("gas_resistance", 0)),
            lux=int(telemetry.get("lux", 0)),
        )

        try:
            record.save()
            logger.info("AWS Cloud record saved successfully to DynamoDB")
        except Exception as aws_err:
            logger.warning("AWS write timeout/failure: %s", aws_err)
