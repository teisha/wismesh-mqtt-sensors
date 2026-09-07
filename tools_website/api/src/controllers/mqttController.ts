import type { Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  createFavorite,
  deleteFavorite,
  findFavoriteById,
  listFavorites,
  updateFavorite,
} from "../services/database/favoritesStore.js";
import { getMqttDefaults, getMqttStatus, isAllowedTopic, publishToMqtt, toPublishQos } from "../services/mqttBroker.js";

type FavoritePayload = {
  name?: string;
  topic?: string;
  payload?: unknown;
  qos?: number;
  retain?: boolean;
};


export async function publishMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { topic, payload, qos, retain } = (req.body ?? {}) as {
    topic?: string;
    payload?: unknown;
    qos?: number;
    retain?: boolean;
  };

  if (!topic || typeof topic !== "string") {
    res.status(400).json({ error: "topic must be a non-empty string" });
    return;
  }

  const { allowedTopics } = getMqttStatus();
  if (!isAllowedTopic(topic)) {
    res.status(403).json({ error: "Topic is not allowed", allowed: allowedTopics });
    return;
  }

  let finalPayload: string;
  if (typeof payload === "string") {
    finalPayload = payload;
  } else if (payload && typeof payload === "object") {
    finalPayload = JSON.stringify(payload);
  } else {
    res.status(400).json({ error: "payload must be a string or object" });
    return;
  }

  const payloadSize = Buffer.byteLength(finalPayload, "utf8");
  const { maxPayloadBytes, defaultQos, defaultRetain } = getMqttDefaults();
  if (payloadSize > maxPayloadBytes) {
    res.status(400).json({ error: `payload exceeds ${maxPayloadBytes} bytes` });
    return;
  }

  const publishQos = toPublishQos(qos, defaultQos);
  const publishRetain = typeof retain === "boolean" ? retain : defaultRetain;

  await publishToMqtt(topic, finalPayload, {
    qos: publishQos,
    retain: publishRetain,
  });

  res.status(202).json({
    status: "published",
    topic,
    qos: publishQos,
    retain: publishRetain,
    payloadBytes: payloadSize,
  });
}

export async function listFavoriteMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const favorites = await listFavorites(req.userId);
  res.json({ favorites });
}

export async function createFavoriteMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, topic, payload, qos, retain } = (req.body ?? {}) as FavoritePayload;
  if (!name || !topic) {
    res.status(400).json({ error: "name and topic are required" });
    return;
  }

  const serializedPayload = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  const created = await createFavorite(req.userId, {
    name,
    topic,
    payload: serializedPayload,
    qos: toPublishQos(qos, 0),
    retain: Boolean(retain),
  });

  if (!created) {
    res.status(409).json({ error: "Favorite name already exists" });
    return;
  }

  res.status(201).json(created);
}

export async function updateFavoriteMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const favoriteId = Number(req.params.favoriteId);
  if (!Number.isInteger(favoriteId) || favoriteId <= 0) {
    res.status(400).json({ error: "favoriteId must be a positive integer" });
    return;
  }

  const { name, topic, payload, qos, retain } = (req.body ?? {}) as FavoritePayload;
  if (!name || !topic) {
    res.status(400).json({ error: "name and topic are required" });
    return;
  }

  const existing = await findFavoriteById(req.userId, favoriteId);
  if (!existing) {
    res.status(404).json({ error: "Favorite not found" });
    return;
  }

  const serializedPayload = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  const updated = await updateFavorite(req.userId, favoriteId, {
    name,
    topic,
    payload: serializedPayload,
    qos: toPublishQos(qos, 0),
    retain: Boolean(retain),
  });

  if (!updated) {
    res.status(409).json({ error: "Favorite name already exists" });
    return;
  }

  res.json(updated);
}

export async function deleteFavoriteMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const favoriteId = Number(req.params.favoriteId);
  if (!Number.isInteger(favoriteId) || favoriteId <= 0) {
    res.status(400).json({ error: "favoriteId must be a positive integer" });
    return;
  }

  const existing = await findFavoriteById(req.userId, favoriteId);
  if (!existing) {
    res.status(404).json({ error: "Favorite not found" });
    return;
  }

  await deleteFavorite(req.userId, favoriteId);
  res.status(204).send();
}