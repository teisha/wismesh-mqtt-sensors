import "dotenv/config";

import { upsertAdminUserWithPassword } from "../src/services/database/authStore.js";
import { initDatabase } from "../src/services/database/init.js";

const username = process.argv[2] || process.env.BOOTSTRAP_ADMIN_USERNAME || "admin";
const password = process.argv[3] || process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!password) {
  console.error("Usage: npm run init-admin -- <username> <password>");
  process.exit(1);
}

initDatabase();

const result = await upsertAdminUserWithPassword(username, password);

if (result === "updated") {
  console.log(`Updated admin user '${username}'`);
} else {
  console.log(`Created admin user '${username}'`);
}
