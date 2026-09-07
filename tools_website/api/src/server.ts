import "dotenv/config";

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";

import { healthCheck } from "./controllers/authController.js";
import { initDatabase } from "./services/database/init.js";
import { registerAdminRoutes } from "./routes/adminRoutes.js";
import { registerAuthRoutes } from "./routes/authRoutes.js";
import { registerMqttRoutes } from "./routes/mqttRoutes.js";
import { countActiveSessions, ensureBootstrapAdmin } from "./services/database/authStore.js";
import { DB_FILE } from "./services/database/client.js";
import { getMqttDefaults, getMqttStatus } from "./services/mqttBroker.js";

const app = express();

const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:8088";
const COOKIE_NAME = process.env.COOKIE_NAME || "garden_hub_session";
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || "false") === "true";
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24);
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

const BOOTSTRAP_ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || "admin";
const BOOTSTRAP_ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const { maxPayloadBytes } = getMqttDefaults();
const { mqttConnected } = getMqttStatus();

app.use(helmet());
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: `${maxPayloadBytes}b` }));
app.use(cookieParser());

app.get("/health", async (_req: Request, res: Response) => {
  const now = Date.now();
  const activeSessions = await countActiveSessions(now);

  res.json({
    service: "tools-api",
    mqttConnected,
    dbFile: DB_FILE,
    activeSessions,
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", healthCheck);

registerAuthRoutes(app);
registerAdminRoutes(app);
registerMqttRoutes(app);

async function start(): Promise<void> {
  initDatabase();
  const created = await ensureBootstrapAdmin(BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD);
  if (created) {
    console.warn("Created bootstrap admin user from BOOTSTRAP_ADMIN_* env vars");
  }

  app.listen(PORT, () => {
    console.log(`tools-api listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start tools-api", error);
  process.exit(1);
});
