import { Router } from "express";

import { clearSessions, login, logout, me } from "../controllers/authController.js";
import { verifySession } from "../middleware/auth.js";

export function registerAuthRoutes(router: Router): void {
  router.post("/auth/login", login);
  router.post("/auth/logout", verifySession, logout);
  router.get("/auth/me", verifySession, me);
  router.post("/auth/sessions/clear", verifySession, clearSessions);
}