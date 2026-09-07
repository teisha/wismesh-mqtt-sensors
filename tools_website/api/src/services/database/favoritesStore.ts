import { and, desc, eq } from "drizzle-orm";

import { FavoriteModel } from "../../models/schema.js";
import { db } from "./client.js";

const favorites = FavoriteModel.columns;

export type FavoriteViewRecord = {
  id: number;
  userId: number;
  name: string;
  topic: string;
  payload: string;
  qos: number;
  retain: boolean;
  createdAt: number;
  updatedAt: number;
};

function mapFavorite(row: {
  id: number;
  userId: number;
  name: string;
  topic: string;
  payload: string;
  qos: number;
  retain: number;
  createdAt: number;
  updatedAt: number;
}): FavoriteViewRecord {
  return {
    ...row,
    retain: Boolean(row.retain),
  };
}

export async function listFavorites(userId: number): Promise<FavoriteViewRecord[]> {
  const rows = await db
    .select({
      id: favorites.id,
      userId: favorites.userId,
      name: favorites.name,
      topic: favorites.topic,
      payload: favorites.payload,
      qos: favorites.qos,
      retain: favorites.retain,
      createdAt: favorites.createdAt,
      updatedAt: favorites.updatedAt,
    })
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.updatedAt), desc(favorites.id));

  return rows.map(mapFavorite);
}

export async function findFavoriteById(userId: number, favoriteId: number): Promise<FavoriteViewRecord | null> {
  const rows = await db
    .select({
      id: favorites.id,
      userId: favorites.userId,
      name: favorites.name,
      topic: favorites.topic,
      payload: favorites.payload,
      qos: favorites.qos,
      retain: favorites.retain,
      createdAt: favorites.createdAt,
      updatedAt: favorites.updatedAt,
    })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.id, favoriteId)))
    .limit(1);

  const row = rows[0];
  return row ? mapFavorite(row) : null;
}

export async function findFavoriteByName(userId: number, name: string): Promise<FavoriteViewRecord | null> {
  const rows = await db
    .select({
      id: favorites.id,
      userId: favorites.userId,
      name: favorites.name,
      topic: favorites.topic,
      payload: favorites.payload,
      qos: favorites.qos,
      retain: favorites.retain,
      createdAt: favorites.createdAt,
      updatedAt: favorites.updatedAt,
    })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.name, name)))
    .limit(1);

  const row = rows[0];
  return row ? mapFavorite(row) : null;
}

export async function createFavorite(
  userId: number,
  input: {
    name: string;
    topic: string;
    payload: string;
    qos: number;
    retain: boolean;
  }
): Promise<FavoriteViewRecord | null> {
  const existing = await findFavoriteByName(userId, input.name);
  if (existing) {
    return null;
  }

  const now = Date.now();
  await db.insert(favorites).values({
    userId,
    name: input.name,
    topic: input.topic,
    payload: input.payload,
    qos: input.qos,
    retain: input.retain ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  return findFavoriteByName(userId, input.name);
}

export async function updateFavorite(
  userId: number,
  favoriteId: number,
  input: {
    name: string;
    topic: string;
    payload: string;
    qos: number;
    retain: boolean;
  }
): Promise<FavoriteViewRecord | null> {
  const existing = await findFavoriteById(userId, favoriteId);
  if (!existing) {
    return null;
  }

  const duplicate = await findFavoriteByName(userId, input.name);
  if (duplicate && duplicate.id !== favoriteId) {
    return null;
  }

  await db
    .update(favorites)
    .set({
      name: input.name,
      topic: input.topic,
      payload: input.payload,
      qos: input.qos,
      retain: input.retain ? 1 : 0,
      updatedAt: Date.now(),
    })
    .where(and(eq(favorites.userId, userId), eq(favorites.id, favoriteId)));

  return findFavoriteById(userId, favoriteId);
}

export async function deleteFavorite(userId: number, favoriteId: number): Promise<number> {
  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.id, favoriteId)));

  return 1;
}