import os
import json
import time
from datetime import datetime
from dotenv import load_dotenv
import paho.mqtt.client as mqtt
from prometheus_client import start_http_server, Gauge
import boto3

# Load configuration values from local secure memory environment
load_dotenv()

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "msh/+/json/#")
PROMETHEUS_PORT = int(os.getenv("PROMETHEUS_PORT", 8000))

# Instantiate the AWS DynamoDB Resource Session Client
try:
    dynamodb = boto3.resource(
        "dynamodb",
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
    )
    db_table = dynamodb.Table(os.getenv("AWS_DYNAMODB_TABLE", "GardenTelemetry"))
    print(f"[*] AWS DynamoDB pipeline initialized targeting table: {db_table.table_name}")
except Exception as e:
    print(f"[!] Warning: Failed to connect to AWS Cloud SDK: {e}")
    db_table = None

# Initialize Prometheus Gauges with custom multi-node labels
LABELS = ["sender", "channel"]
temp_gauge = Gauge("garden_temperature_celsius", "Temperature in degrees Celsius", LABELS)
humidity_gauge = Gauge("garden_humidity_percent", "Relative humidity percentage", LABELS)
pressure_gauge = Gauge("garden_pressure_hpa", "Barometric pressure in hPa", LABELS)
iaq_gauge = Gauge("garden_iaq_score", "Indoor Air Quality index rating", LABELS)
gas_gauge = Gauge("garden_gas_resistance_kohm", "Gas resistance value from sensor", LABELS)
lux_gauge = Gauge("garden_light_lux", "Ambient light reading in Lux", LABELS)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"[*] Connected to Mosquitto Broker at {MQTT_BROKER}")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"[!] Connection failed with error code: {rc}")

def on_message(client, userdata, msg):
    try:
        payload_data = json.loads(msg.payload.decode("utf-8"))
        
        if payload_data.get("type") == "telemetry" and "payload" in payload_data:
            sender = payload_data.get("sender", "unknown")
            channel = str(payload_data.get("channel", "unknown"))
            telemetry = payload_data["payload"]
            
            # --- PIPELINE 1: Expose local metrics to Prometheus ---
            if "temperature" in telemetry:
                temp_gauge.labels(sender=sender, channel=channel).set(telemetry["temperature"])
            if "relative_humidity" in telemetry:
                humidity_gauge.labels(sender=sender, channel=channel).set(telemetry["relative_humidity"])
            if "barometric_pressure" in telemetry:
                pressure_gauge.labels(sender=sender, channel=channel).set(telemetry["barometric_pressure"])
            if "iaq" in telemetry:
                iaq_gauge.labels(sender=sender, channel=channel).set(telemetry["iaq"])
            if "gas_resistance" in telemetry:
                gas_gauge.labels(sender=sender, channel=channel).set(telemetry["gas_resistance"])
            if "lux" in telemetry:
                lux_gauge.labels(sender=sender, channel=channel).set(telemetry["lux"])
                
            print(f"[+] Local metrics exposed for: {sender}")
            
            # --- PIPELINE 2: Stream copy directly to AWS DynamoDB NoSQL Cloud ---
            if db_table:
                # Generate a clean, human-readable ISO timestamp string for the Sort Key
                timestamp_iso = datetime.utcnow().isoformat() + "Z"
                
                # Format raw numbers cleanly into string format or floats for NoSQL absorption
                db_item = {
                    "PK": f"NODE#{sender}",                # Partition Key (String)
                    "SK": f"TS#{timestamp_iso}",           # Sort Key (String)
                    "search_attribute": f"CHANNEL#{channel}",
                    "node_id": sender,
                    "timestamp": timestamp_iso,
                    "channel_index": channel,
                    "temperature": str(telemetry.get("temperature")),
                    "humidity": str(telemetry.get("relative_humidity")),
                    "pressure": str(telemetry.get("barometric_pressure")),
                    "iaq": int(telemetry.get("iaq", 0)),
                    "gas_res": str(telemetry.get("gas_resistance", 0)),
                    "lux": int(telemetry.get("lux", 0))
                }
                
                try:
                    db_table.put_item(Item=db_item)
                    print(f"    └── [AWS Cloud] Record saved successfully to DynamoDB.")
                except Exception as aws_err:
                    print(f"    └── [!] AWS Write Timeout/Failure: {aws_err}")

    except Exception as e:
        print(f"[!] Error parsing incoming packet stream: {e}")

def main():
    start_http_server(PROMETHEUS_PORT)
    print(f"[*] Prometheus web metrics server running on port :{PROMETHEUS_PORT}")

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect_async(MQTT_BROKER, MQTT_PORT, keepalive=60)
    
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[-] Shutting down Python data telemetry loop.")

if __name__ == "__main__":
    main()