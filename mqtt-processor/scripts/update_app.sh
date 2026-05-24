#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$APP_DIR/.venv"
SERVICE_NAME="garden-telemetry.service"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME"
SERVICE_TEMPLATE="$APP_DIR/systemd/garden-telemetry.service"
ENV_SOURCE_FILE="$HOME/.config/garden-telemetry.env"
ENV_TARGET_FILE="/etc/default/garden-telemetry"
TMP_SERVICE_FILE="$(mktemp)"

cleanup() {
  rm -f "$TMP_SERVICE_FILE"
}
trap cleanup EXIT

restart_service() {
  if [[ ! -f "$SERVICE_TEMPLATE" ]]; then
    echo "Error: service template not found at $SERVICE_TEMPLATE"
    exit 1
  fi

  sed \
    -e "s|{{APP_DIR}}|$APP_DIR|g" \
    -e "s|{{VENV_PYTHON}}|$VENV_DIR/bin/python|g" \
    -e "s|{{APP_PY}}|$APP_DIR/src/app.py|g" \
    -e "s|{{SERVICE_USER}}|$(id -un)|g" \
    -e "s|{{SERVICE_GROUP}}|$(id -gn)|g" \
    "$SERVICE_TEMPLATE" > "$TMP_SERVICE_FILE"

  echo "Requesting sudo once for system service update"
  sudo -v

  if [[ -f "$ENV_SOURCE_FILE" ]]; then
    echo "Installing env file to $ENV_TARGET_FILE"
    sudo install -m 0644 "$ENV_SOURCE_FILE" "$ENV_TARGET_FILE"
  else
    echo "Warning: env file not found at $ENV_SOURCE_FILE (keeping existing $ENV_TARGET_FILE if present)"
  fi

  sudo install -m 0644 "$TMP_SERVICE_FILE" "$SERVICE_FILE"
  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
  if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    sudo systemctl restart "$SERVICE_NAME"
    echo "Restarted $SERVICE_NAME"
  else
    sudo systemctl start "$SERVICE_NAME"
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

restart_service

echo "Update complete. Tail logs with: sudo journalctl -u $SERVICE_NAME -f"