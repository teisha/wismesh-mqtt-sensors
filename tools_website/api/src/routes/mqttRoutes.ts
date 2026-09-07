import { Router } from "express";

import {
  createFavoriteMessage,
  deleteFavoriteMessage,
  listFavoriteMessages,
  publishMessage,
  updateFavoriteMessage,
} from "../controllers/mqttController.js";
import { verifySession } from "../middleware/auth.js";

export function registerMqttRoutes(router: Router): void {
  router.post("/mqtt/publish", verifySession, publishMessage);
  router.get("/mqtt/favorites", verifySession, listFavoriteMessages);
  router.post("/mqtt/favorites", verifySession, createFavoriteMessage);
  router.put("/mqtt/favorites/:favoriteId", verifySession, updateFavoriteMessage);
  router.delete("/mqtt/favorites/:favoriteId", verifySession, deleteFavoriteMessage);
}