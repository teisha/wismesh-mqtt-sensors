import { randomUUID } from "node:crypto";

import { verify as argon2Verify } from "@node-rs/argon2";
import type { Request, Response } from "express";

import { findUserByUsername } from "../services/database/authStore.js";
import { createSession, countActiveSessions, revokeAllActiveSessions, revokeSessionById, revokeUserActiveSessions, setUserLastLogin } from "../services/database/authStore.js";
import { DB_FILE } from "../services/database/client.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { clearSessionCookie, COOKIE_NAME, COOKIE_SECURE, hashSessionToken, issueSessionToken } from "../middleware/auth.js";
import { getMqttStatus } from "../services/mqttBroker.js";

const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24);
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const now = Date.now();
  const activeSessions = await countActiveSessions(now);
  const { mqttConnected } = getMqttStatus();

  res.json({
    service: "tools-api",
    mqttConnected,
    dbFile: DB_FILE,
    activeSessions,
    timestamp: new Date().toISOString(),
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = (req.body ?? {}) as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const user = await findUserByUsername(username);

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const isValid = await argon2Verify(user.passwordHash, password);

  if (!isValid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const now = Date.now();
  const token = issueSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = now + SESSION_TTL_MS;

  await createSession({
    sessionId: randomUUID(),
    userId: user.id,
    tokenHash,
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
  });

  await setUserLastLogin(user.id, now);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });

  res.json({
    userId: user.id,
    username: user.username,
    role: user.role,
    authenticated: true,
    expiresInHours: SESSION_TTL_HOURS,
  });
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.sessionId) {
    await revokeSessionById(req.sessionId, Date.now());
  }

  clearSessionCookie(res);
  res.status(204).send();
}

export function me(req: AuthenticatedRequest, res: Response): void {
  res.json({
    userId: req.userId,
    username: req.username,
    role: req.role,
    authenticated: true,
  });
}

export async function clearSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const now = Date.now();
  const body = (req.body ?? {}) as { scope?: "current" | "user" | "all" };
  const scope = body.scope || "user";

  if (!req.userId || !req.sessionId || !req.role) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (scope === "current") {
    await revokeSessionById(req.sessionId, now);
    clearSessionCookie(res);
    res.json({ scope, revokedCount: 1 });
    return;
  }

  if (scope === "all") {
    if (req.role !== "admin") {
      res.status(403).json({ error: "Only admin can clear all sessions" });
      return;
    }

    const revokedCount = await revokeAllActiveSessions(now);
    clearSessionCookie(res);
    res.json({ scope, revokedCount });
    return;
  }

  const revokedCount = await revokeUserActiveSessions(req.userId, now);
  clearSessionCookie(res);
  res.json({ scope: "user", revokedCount });
}