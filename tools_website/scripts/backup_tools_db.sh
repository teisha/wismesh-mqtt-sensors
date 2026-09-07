#!/usr/bin/env bash

set -euo pipefail

SRC_DB="/mnt/storage/tools_api_data/tools-website.db"
BACKUP_DIR="/mnt/storage/tools_api_backups"
BACKUP_DB="$BACKUP_DIR/tools-website-latest.db"
TMP_DB="$BACKUP_DB.tmp"

if ! mountpoint -q /mnt/storage; then
  echo "[backup_tools_db] /mnt/storage is not mounted; skipping backup" >&2
  exit 0
fi

if [[ ! -f "$SRC_DB" ]]; then
  echo "[backup_tools_db] source DB not found at $SRC_DB; skipping backup" >&2
  exit 0
fi

mkdir -p "$BACKUP_DIR"

# Use sqlite's online backup API to avoid corrupt snapshots while app is writing.
python3 - <<'PY'
import sqlite3
from pathlib import Path

src = Path("/mnt/storage/tools_api_data/tools-website.db")
tmp = Path("/mnt/storage/tools_api_backups/tools-website-latest.db.tmp")

src_conn = sqlite3.connect(src)
try:
    tmp_conn = sqlite3.connect(tmp)
    try:
        src_conn.backup(tmp_conn)
    finally:
        tmp_conn.close()
finally:
    src_conn.close()
PY

mv -f "$TMP_DB" "$BACKUP_DB"
chmod 600 "$BACKUP_DB"

echo "[backup_tools_db] backup written to $BACKUP_DB"
