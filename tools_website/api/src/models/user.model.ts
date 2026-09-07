import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("user"),
    createdAt: integer("created_at").notNull(),
    lastLoginAt: integer("last_login_at"),
  },
  (table) => [uniqueIndex("users_username_idx").on(table.username)]
);

export class UserModel {
  static readonly table = usersTable;
  static readonly columns = usersTable;
}

export type UserRecord = InferSelectModel<typeof usersTable>;
export type NewUserRecord = InferInsertModel<typeof usersTable>;