# tools_website/ui

TypeScript React UI for the Garden Hub tools website.

## What it does

- Login page for the local admin account
- MQTT publishing form as the first tool
- Calls backend endpoints under `/api`
- Implemented in TypeScript (TSX)

## Local development

```bash
npm install
npm run dev
```

Build production assets:

```bash
npm run build
```

By default Vite runs on http://localhost:5173.

## Production in this repo

The Dockerfile builds the React app and serves it with Nginx on port 8088.
Nginx proxies `/api` requests to the backend `tools-api` container.
