#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$APP_DIR/.venv"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/garden-telemetry.service"
SERVICE_TEMPLATE="$APP_DIR/systemd/garden-telemetry.service"

mkdir -p "$SERVICE_DIR"

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
	"$SERVICE_TEMPLATE" > "$SERVICE_FILE"

systemctl --user daemon-reload
systemctl --user enable --now garden-telemetry.service

echo "Deployed and started garden-telemetry.service"