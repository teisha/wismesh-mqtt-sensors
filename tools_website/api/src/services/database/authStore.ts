import { Algorithm, hash as argon2Hash } from "@node-rs/argon2";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";

import { SessionModel, UserModel } from "../../models/schema.js";
import { db, sqlite } from "./client.js";

const users = UserModel.columns;
const sessions = SessionModel.columns;

export type LoginUserRecord = {
  id: number;
  username: string;
  passwordHash: string;
  role: string;
};

export type ActiveSessionRecord = {
  sessionId: string;
  userId: number;
  username: string;
  role: string;
};

export type ManagedUserRecord = {
  id: number;
  username: string;
  role: string;
  createdAt: number;
  lastLoginAt: number | null;
};

function normalizeRole(role?: string): string {
  return role === "admin" ? "admin" : "user";
}

function mapManagedUser(row: {
  id: number;
  username: string;
  role: string;
  createdAt: number;
  lastLoginAt: number | null;
}): ManagedUserRecord {
  return row;
}

function getLastChangeCount(): number {
  const row = sqlite.prepare("SELECT changes() AS count").get() as { count?: number } | undefined;
  return row?.count ?? 0;
}

async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
}

export async function findUserByUsername(username: string): Promise<LoginUserRecord | null> {
  const rows = await db
    .select({ id: users.id, username: users.username, passwordHash: users.passwordHash, role: users.role })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return rows[0] ?? null;
}

export async function findManagedUserById(userId: number): Promise<ManagedUserRecord | null> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  return row ? mapManagedUser(row) : null;
}

export async function listManagedUsers(): Promise<ManagedUserRecord[]> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(asc(users.username));

  return rows.map(mapManagedUser);
}

export async function createManagedUser(input: {
  username: string;
  password: string;
  role?: string;
}): Promise<ManagedUserRecord | null> {
  const existing = await findUserByUsername(input.username);
  if (existing) {
    return null;
  }

  const passwordHash = await hashPassword(input.password);
  const now = Date.now();

  await db.insert(users).values({
    username: input.username,
    passwordHash,
    role: normalizeRole(input.role),
    createdAt: now,
    lastLoginAt: null,
  });

  return findManagedUserById((await findUserByUsername(input.username))?.id ?? 0);
}

export async function updateManagedUser(
  userId: number,
  input: {
    username: string;
    password?: string;
    role?: string;
  }
): Promise<ManagedUserRecord | null> {
  const existing = await findManagedUserById(userId);
  if (!existing) {
    return null;
  }

  const duplicate = await findUserByUsername(input.username);
  if (duplicate && duplicate.id !== userId) {
    return null;
  }

  const setValues: Record<string, string | number> = {
    username: input.username,
    role: normalizeRole(input.role),
  };

  if (input.password) {
    setValues.passwordHash = await hashPassword(input.password);
  }

  await db.update(users).set(setValues).where(eq(users.id, userId));

  return findManagedUserById(userId);
}

export async function deleteUserById(userId: number): Promise<number> {
  await db.delete(users).where(eq(users.id, userId));

  return getLastChangeCount();
}

export async function setUserLastLogin(userId: number, now: number): Promise<void> {
  await db
    .update(users)
    .set({ lastLoginAt: now })
    .where(eq(users.id, userId));
}

export async function createSession(input: {
  sessionId: string;
  userId: number;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
}): Promise<void> {
  await db.insert(sessions).values({
    id: input.sessionId,
    userId: input.userId,
    tokenHash: input.tokenHash,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    lastSeenAt: input.lastSeenAt,
    revokedAt: null,
  });
}

export async function findActiveSessionByTokenHash(tokenHash: string, now: number): Promise<ActiveSessionRecord | null> {
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      username: users.username,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
    .limit(1);

  return rows[0] ?? null;
}

export async function touchSession(sessionId: string, now: number): Promise<void> {
  await db
    .update(sessions)
    .set({ lastSeenAt: now })
    .where(eq(sessions.id, sessionId));
}

export async function revokeSessionById(sessionId: string, revokedAt: number): Promise<number> {
  await db
    .update(sessions)
    .set({ revokedAt })
    .where(eq(sessions.id, sessionId));

  return getLastChangeCount();
}

export async function revokeAllActiveSessions(revokedAt: number): Promise<number> {
  await db
    .update(sessions)
    .set({ revokedAt })
    .where(isNull(sessions.revokedAt));

  return getLastChangeCount();
}

export async function revokeUserActiveSessions(userId: number, revokedAt: number): Promise<number> {
  await db
    .update(sessions)
    .set({ revokedAt })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

  return getLastChangeCount();
}

export async function countActiveSessions(now: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, now)));

  return rows[0]?.count ?? 0;
}

export async function ensureBootstrapAdmin(username: string, password?: string): Promise<boolean> {
  if (!password) {
    return false;
  }

  const existing = await findUserByUsername(username);
  if (existing) {
    return false;
  }

  const passwordHash = await hashPassword(password);
  const now = Date.now();

  await db.insert(users).values({
    username,
    passwordHash,
    role: "admin",
    createdAt: now,
    lastLoginAt: null,
  });

  return true;
}

export async function upsertAdminUserWithPassword(username: string, password: string): Promise<"created" | "updated"> {
  const passwordHash = await hashPassword(password);
  const existing = await findUserByUsername(username);

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, role: "admin" })
      .where(eq(users.username, username));

    return "updated";
  }

  await db.insert(users).values({
    username,
    passwordHash,
    role: "admin",
    createdAt: Date.now(),
    lastLoginAt: null,
  });

  return "created";
}
