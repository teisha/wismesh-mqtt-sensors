import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { usersTable } from "./user.model.js";

export const mqttFavoritesTable = sqliteTable(
  "mqtt_favorites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    topic: text("topic").notNull(),
    payload: text("payload").notNull(),
    qos: integer("qos").notNull().default(0),
    retain: integer("retain").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("mqtt_favorites_user_name_idx").on(table.userId, table.name)]
);

export class FavoriteModel {
  static readonly table = mqttFavoritesTable;
  static readonly columns = mqttFavoritesTable;
}

export type FavoriteRecord = InferSelectModel<typeof mqttFavoritesTable>;
export type NewFavoriteRecord = InferInsertModel<typeof mqttFavoritesTable>;