import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { usersTable } from "./user.model.js";

export const sessionsTable = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    revokedAt: integer("revoked_at"),
  },
  (table) => [uniqueIndex("sessions_token_hash_idx").on(table.tokenHash)]
);

export class SessionModel {
  static readonly table = sessionsTable;
  static readonly columns = sessionsTable;
}

export type SessionRecord = InferSelectModel<typeof sessionsTable>;
export type NewSessionRecord = InferInsertModel<typeof sessionsTable>;