import os
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
import paho.mqtt.client as mqtt
from prometheus_client import start_http_server

try:
    from src.handlers.garden_telemetry import handle_garden_telemetry_message
    from src.services.dynamodb import get_dynamodb_table
    from src.utils.logger import setup_logger
except ModuleNotFoundError:  # pragma: no cover - fallback for script execution
    from handlers.garden_telemetry import handle_garden_telemetry_message
    from services.dynamodb import get_dynamodb_table
    from utils.logger import setup_logger

# Load configuration values from local secure memory environment
load_dotenv()

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
GARDEN_MQTT_TOPIC = os.getenv("GARDEN_MQTT_TOPIC", os.getenv("MQTT_TOPIC", "msh/+/json/#"))
PROMETHEUS_PORT = int(os.getenv("PROMETHEUS_PORT", 8000))
logger = setup_logger()
db_table = get_dynamodb_table(logger)


def is_garden_topic(topic: str) -> bool:
    lower_topic = topic.lower()
    return (
        topic.startswith("msh/")
        and (
            "/json/" in lower_topic
            or "/e/" in lower_topic
            or "secretgardn" in lower_topic
            or topic == GARDEN_MQTT_TOPIC
        )
    )


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        logger.info("Connected to Mosquitto broker at %s", MQTT_BROKER)
        client.subscribe(GARDEN_MQTT_TOPIC)
        logger.info("Subscribed to MQTT topic: %s", GARDEN_MQTT_TOPIC)
    else:
        logger.error("Connection failed with error code: %s", reason_code)


def on_message(client, userdata, msg):
    topic = msg.topic
    if not is_garden_topic(topic):
        logger.debug("Ignoring non-garden MQTT topic: %s", topic)
        return

    try:
        logger.info("Inbound MQTT message topic=%s bytes=%s", topic, len(msg.payload))

        try:
            payload = msg.payload.decode("utf-8")
        except UnicodeDecodeError:
            payload = msg.payload.decode("utf-8", errors="replace")
            logger.warning("Non-UTF8 MQTT payload received on topic=%s; undecodable bytes were replaced", topic)

        logger.debug("Received garden MQTT message on topic=%s", topic)
        handle_garden_telemetry_message(logger, payload, db_table)
    except Exception as exc:
        logger.warning("Error handling incoming packet stream on topic=%s: %s", topic, exc)

def main():
    try:
        start_http_server(PROMETHEUS_PORT)
        print(f"Prometheus metrics server running on port {PROMETHEUS_PORT}")
    except OSError:
        print(f"Port {PROMETHEUS_PORT} in use or socket busy. Proceeding with MQTT loop.")    
    logger.info("Prometheus web metrics server running on port %s", PROMETHEUS_PORT)

    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect_async(MQTT_BROKER, MQTT_PORT, keepalive=60)
    
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down Python data telemetry loop")

if __name__ == "__main__":
    main()