from typing import Any, Dict, Optional, Tuple


def parse_telemetry_message(payload_data: Dict[str, Any]) -> Optional[Tuple[str, str, Dict[str, Any]]]:
    """Return normalized telemetry fields or None for non-telemetry payloads."""
    if payload_data.get("type") != "telemetry" or "payload" not in payload_data:
        return None

    sender = payload_data.get("sender", "unknown")
    channel = str(payload_data.get("channel", "unknown"))
    telemetry = payload_data["payload"]
    return sender, channel, telemetry
