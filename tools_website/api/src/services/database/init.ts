import path from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db, sqlite } from "./client.js";

export function initDatabase(): void {
  migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mqtt_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      topic TEXT NOT NULL,
      payload TEXT NOT NULL,
      qos INTEGER NOT NULL DEFAULT 0,
      retain INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS mqtt_favorites_user_name_idx
      ON mqtt_favorites (user_id, name);
  `);
}
