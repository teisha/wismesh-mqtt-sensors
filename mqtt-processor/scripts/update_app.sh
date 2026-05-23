#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$APP_DIR/.venv"
ENV_FILE="$APP_DIR/.env"
ENV_TEMPLATE="$APP_DIR/.env.example"
SERVICE_NAME="garden-telemetry.service"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/$SERVICE_NAME"
SERVICE_TEMPLATE="$APP_DIR/systemd/garden-telemetry.service"

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

restart_service() {
  mkdir -p "$SERVICE_DIR"
  if [[ ! -f "$SERVICE_TEMPLATE" ]]; then
    echo "Error: service template not found at $SERVICE_TEMPLATE"
    exit 1
  fi

  sed \
    -e "s|{{APP_DIR}}|$APP_DIR|g" \
    -e "s|{{VENV_PYTHON}}|$VENV_DIR/bin/python|g" \
    -e "s|{{APP_PY}}|$APP_DIR/src/app.py|g" \
    "$SERVICE_TEMPLATE" > "$SERVICE_FILE"

  systemctl --user daemon-reload
  systemctl --user enable "$SERVICE_NAME" >/dev/null 2>&1 || true
  if systemctl --user is-active --quiet "$SERVICE_NAME"; then
    systemctl --user restart "$SERVICE_NAME"
    echo "Restarted $SERVICE_NAME"
  else
    systemctl --user start "$SERVICE_NAME"
    echo "Started $SERVICE_NAME"
  fi
}

cd "$APP_DIR"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  git pull --ff-only origin "$current_branch"
fi

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt"

merge_missing_env_keys
restart_service

echo "Update complete. Tail logs with: journalctl --user -u $SERVICE_NAME -f"