import os
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
import paho.mqtt.client as mqtt
from prometheus_client import start_http_server

try:
    from src.handlers.garden_telemetry import handle_garden_telemetry_message
    from src.handlers.speaker_log import handle_speaker_log_message
    from src.services.dynamodb import get_dynamodb_table
    from src.utils.logger import setup_logger
except ModuleNotFoundError:  # pragma: no cover - fallback for script execution
    from handlers.garden_telemetry import handle_garden_telemetry_message
    from handlers.speaker_log import handle_speaker_log_message
    from services.dynamodb import get_dynamodb_table
    from utils.logger import setup_logger

# Load configuration values from local secure memory environment
load_dotenv()

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
GARDEN_MQTT_TOPIC = os.getenv("GARDEN_MQTT_TOPIC", os.getenv("MQTT_TOPIC", "msh/+/json/#"))
HOUSE_MQTT_TOPIC = os.getenv("HOUSE_MQTT_TOPIC", "house/#")
PROMETHEUS_PORT = int(os.getenv("PROMETHEUS_PORT", 8000))
logger = setup_logger()
db_table = get_dynamodb_table(logger)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to Mosquitto broker at %s", MQTT_BROKER)
        subscriptions = [GARDEN_MQTT_TOPIC, HOUSE_MQTT_TOPIC]
        for topic in subscriptions:
            client.subscribe(topic)
            logger.info("Subscribed to MQTT topic: %s", topic)
    else:
        logger.error("Connection failed with error code: %s", rc)


def on_message(client, userdata, msg):
    payload = msg.payload.decode("utf-8")
    topic = msg.topic

    try:
        if topic.startswith("house/"):
            handle_speaker_log_message(logger, topic, payload)
            return

        if topic.startswith("msh/") or topic == GARDEN_MQTT_TOPIC:
            handle_garden_telemetry_message(logger, payload, db_table)
            return

        logger.debug("Ignoring unhandled MQTT topic: %s", topic)
    except Exception as exc:
        logger.warning("Error handling incoming packet stream on topic=%s: %s", topic, exc)

def main():
    start_http_server(PROMETHEUS_PORT)
    logger.info("Prometheus web metrics server running on port %s", PROMETHEUS_PORT)

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect_async(MQTT_BROKER, MQTT_PORT, keepalive=60)
    
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down Python data telemetry loop")

if __name__ == "__main__":
    main()