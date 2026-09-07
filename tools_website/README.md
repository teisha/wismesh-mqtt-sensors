# tools_website

Standalone TypeScript web tools module for Garden Hub.

## Module layout

- `api/` - backend API (Express + TypeScript) with login and protected actions
- `ui/` - frontend UI (React + Vite + TypeScript)

## First shipped tool

- MQTT publisher with topic + payload input

## Planned expansion

- Service status checks
- Observability quick views
- Additional operational tools

## Deploy path

This module is deployed as part of the compose stack through:

- `ansible/deploy_compose.yml`

The playbook syncs `tools_website/` to `~/telemetry/tools_website` on the Pi.
The API database is stored persistently at `/mnt/storage/tools_api_data/tools-website.db`.

## Nightly DB backup

The compose playbook also installs a nightly cron backup job on the Pi:

- Script: `~/telemetry/tools_website/scripts/backup_tools_db.sh`
- Schedule: daily at `02:15`
- Output file: `/mnt/storage/tools_api_backups/tools-website-latest.db`

Only the latest backup is kept because each run overwrites the same file.

## Local Docker helper

From the repo root:

```bash
./tools_web.sh build
./tools_web.sh up
./tools_web.sh down
./tools_web.sh tdr
```

`down` only stops containers and does not remove existing data.

To target one service:

```bash
./tools_web.sh build api
./tools_web.sh build web
```
