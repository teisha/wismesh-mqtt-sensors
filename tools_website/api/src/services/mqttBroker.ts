import mqtt from "mqtt";

type PublishQos = 0 | 1 | 2;

const MQTT_URL = process.env.MQTT_URL || "mqtt://mosquitto:1883";
const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID || "garden-hub-tools-api";
const MQTT_ALLOWED_TOPICS = (process.env.MQTT_ALLOWED_TOPICS || "house/#")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const MQTT_DEFAULT_QOS = Number(process.env.MQTT_DEFAULT_QOS || 0);
const MQTT_DEFAULT_RETAIN = String(process.env.MQTT_DEFAULT_RETAIN || "false") === "true";
const MAX_PAYLOAD_BYTES = Number(process.env.MAX_PAYLOAD_BYTES || 4096);

const mqttClient = mqtt.connect(MQTT_URL, {
  clientId: MQTT_CLIENT_ID,
  reconnectPeriod: 2000,
});

let mqttConnected = false;

mqttClient.on("connect", () => {
  mqttConnected = true;
  console.log("tools-api connected to MQTT broker");
});

mqttClient.on("reconnect", () => {
  mqttConnected = false;
});

mqttClient.on("close", () => {
  mqttConnected = false;
});

mqttClient.on("error", (error: Error) => {
  console.error("tools-api broker error", error.message);
});

function topicPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split("/")
    .map((segment) => {
      if (segment === "+") {
        return "[^/]+";
      }
      if (segment === "#") {
        return ".*";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");

  return new RegExp(`^${escaped}$`);
}

const topicMatchers = MQTT_ALLOWED_TOPICS.map(topicPatternToRegExp);

export function isAllowedTopic(topic: string): boolean {
  return topicMatchers.some((matcher) => matcher.test(topic));
}

export function toPublishQos(value: unknown, fallback: number | PublishQos): PublishQos {
  if (value === 0 || value === 1 || value === 2) {
    return value;
  }

  return fallback as PublishQos;
}

export function publishToMqtt(topic: string, payload: string, options: mqtt.IClientPublishOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, payload, options, (error?: Error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export function getMqttStatus(): { mqttConnected: boolean; allowedTopics: string[] } {
  return {
    mqttConnected,
    allowedTopics: MQTT_ALLOWED_TOPICS,
  };
}

export function getMqttDefaults(): { defaultQos: number; defaultRetain: boolean; maxPayloadBytes: number } {
  return {
    defaultQos: toPublishQos(MQTT_DEFAULT_QOS, 0),
    defaultRetain: MQTT_DEFAULT_RETAIN,
    maxPayloadBytes: MAX_PAYLOAD_BYTES,
  };
}