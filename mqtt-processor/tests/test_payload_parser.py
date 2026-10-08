import json

from src.handlers.garden_telemetry import handle_garden_telemetry_message
from src.payload_parser import parse_telemetry_message


def test_parse_telemetry_message_success():
    payload_data = {
        "type": "telemetry",
        "sender": "!02ec1d54",
        "channel": 1,
        "payload": {
            "temperature": 29.1,
            "relative_humidity": 40.5,
        },
    }

    sender, channel, telemetry = parse_telemetry_message(payload_data)

    assert sender == "!02ec1d54"
    assert channel == "1"
    assert telemetry["temperature"] == 29.1


def test_parse_telemetry_message_non_telemetry():
    payload_data = {
        "type": "position",
        "sender": "!02ec1d54",
        "channel": 1,
        "payload": {"latitude": 1.23, "longitude": 4.56},
    }

    assert parse_telemetry_message(payload_data) is None


def test_handle_garden_telemetry_message_reuses_metrics_registry():
    payload_data = {
        "type": "telemetry",
        "sender": "!02ec1d54",
        "channel": 1,
        "payload": {
            "temperature": 20.4,
            "relative_humidity": 55,
            "barometric_pressure": 1013,
            "iaq": 42,
            "gas_resistance": 1700,
            "lux": 900,
        },
    }

    class DummyLogger:
        def info(self, *args, **kwargs):
            pass

        def warning(self, *args, **kwargs):
            pass

    for _ in range(2):
        handle_garden_telemetry_message(DummyLogger(), json.dumps(payload_data), None)
