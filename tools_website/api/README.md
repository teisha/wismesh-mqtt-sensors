# tools_website/api

TypeScript backend API for the Garden Hub tools website.

## Features

- Drizzle ORM with SQLite local datastore
- Argon2id password verification
- DB-backed sessions stored in the `sessions` table
- Protected MQTT publish endpoint
- Topic allowlist controls to prevent accidental broker misuse
- Docker-ready for Raspberry Pi deploy via compose
- Implemented in TypeScript and compiled to `dist/`

## Local run

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Initialize admin account in the DB:

```bash
npm run init-admin -- admin "change-me"
```

Or set `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` in `.env` for one-time auto-bootstrap on startup.

4. Start the API:

```bash
npm run dev
```

5. Build TypeScript output:

```bash
npm run build
```

## Schema and migrations

- Schema lives in model class files:
	- `src/models/user.model.ts`
	- `src/models/session.model.ts`
- Startup initialization runs Drizzle migrations from `drizzle/` via `initDatabase()`.
- To generate a new migration after schema changes:

```bash
npm run db:generate
```

## Compose deploy env file

For compose deployment in this repo, update the local file:

- `tools_website/api/config/tools-website.env`

At minimum, set:

- `DB_FILE`
- `SESSION_TTL_HOURS` (defaults to 24)
- `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` for initial user creation

## Main endpoints

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/sessions/clear` with scope `current`, `user`, or `all` (`all` requires admin)
- `POST /mqtt/publish`
- `GET /health`
