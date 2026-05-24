#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt"

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

echo "Requesting sudo once for system service install/restart"
sudo -v

if [[ -f "$ENV_SOURCE_FILE" ]]; then
  echo "Installing env file to $ENV_TARGET_FILE"
  sudo install -m 0644 "$ENV_SOURCE_FILE" "$ENV_TARGET_FILE"
else
  echo "Warning: env file not found at $ENV_SOURCE_FILE (continuing without it)"
fi

sudo install -m 0644 "$TMP_SERVICE_FILE" "$SERVICE_FILE"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"

echo "Deployed and started $SERVICE_NAME"