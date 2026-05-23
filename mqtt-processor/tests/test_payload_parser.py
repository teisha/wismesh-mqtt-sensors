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
