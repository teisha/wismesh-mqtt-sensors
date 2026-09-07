import type { NextFunction, Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";

import { findActiveSessionByTokenHash, touchSession } from "../services/database/authStore.js";

export interface AuthenticatedRequest extends Request {
  userId?: number;
  username?: string;
  role?: string;
  sessionId?: string;
}

export const COOKIE_NAME = process.env.COOKIE_NAME || "garden_hub_session";
export const COOKIE_SECURE = String(process.env.COOKIE_SECURE || "false") === "true";

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueSessionToken(): string {
  return randomBytes(48).toString("base64url");
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    sameSite: "lax",
    secure: COOKIE_SECURE,
    httpOnly: true,
  });
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

export async function verifySession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies[COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const now = Date.now();
  const tokenHash = hashSessionToken(token);

  const session = await findActiveSessionByTokenHash(tokenHash, now);

  if (!session) {
    clearSessionCookie(res);
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.sessionId = session.sessionId;
  req.userId = session.userId;
  req.username = session.username;
  req.role = session.role;

  await touchSession(session.sessionId, now);

  next();
}