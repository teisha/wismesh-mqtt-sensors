#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_DIR/mqtt-processor"
VENV_DIR="$APP_DIR/.venv"
ENV_FILE="$APP_DIR/.env"
ENV_TEMPLATE="$APP_DIR/.env.example"
PID_FILE="$APP_DIR/bridge.pid"
LOG_FILE="$APP_DIR/bridge.log"

merge_missing_env_keys() {
  if [[ ! -f "$ENV_TEMPLATE" ]]; then
    return
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    echo "Created local .env from .env.example"
    return
  fi

  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    [[ -z "$key" ]] && continue

    if ! grep -qE "^[[:space:]]*${key}=" "$ENV_FILE"; then
      echo "$line" >> "$ENV_FILE"
      echo "Added missing .env key: $key"
    fi
  done < "$ENV_TEMPLATE"
}

restart_bridge() {
  if [[ -f "$PID_FILE" ]]; then
    old_pid="$(cat "$PID_FILE")"
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
      kill "$old_pid"
      echo "Stopped previous bridge process PID $old_pid"
    fi
  fi

  nohup "$VENV_DIR/bin/python" "$APP_DIR/bridge.py" >> "$LOG_FILE" 2>&1 &
  new_pid=$!
  echo "$new_pid" > "$PID_FILE"
  echo "Started bridge process PID $new_pid"
}

cd "$REPO_DIR"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  git pull --ff-only origin "$current_branch"
fi

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt"

merge_missing_env_keys
restart_bridge

echo "Update complete. Tail logs with: tail -f $LOG_FILE"