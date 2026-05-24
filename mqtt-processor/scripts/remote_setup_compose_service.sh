#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <compose_service_name>"
  exit 1
fi

COMPOSE_SERVICE_NAME="$1"
REMOTE_HOME="$(printf %s "$HOME")"
REMOTE_APP_DIR="$REMOTE_HOME/mqtt-processor"
REMOTE_STACK_DIR="$REMOTE_HOME/telemetry"
SERVICE_TEMPLATE="$REMOTE_APP_DIR/systemd/$COMPOSE_SERVICE_NAME"
TMP_SERVICE_FILE="$(mktemp)"

cleanup() {
  rm -f "$TMP_SERVICE_FILE"
}
trap cleanup EXIT

if [[ ! -f "$REMOTE_STACK_DIR/docker-compose.yaml" ]]; then
  echo "Skipping compose service setup: $REMOTE_STACK_DIR/docker-compose.yaml not found"
  exit 0
fi

if [[ ! -f "$SERVICE_TEMPLATE" ]]; then
  echo "Error: compose systemd template not found at $SERVICE_TEMPLATE"
  exit 1
fi

if mountpoint -q /mnt/storage; then
  echo "Detected /mnt/storage mount; preparing Grafana and Prometheus data directories"
  sudo install -d -m 0775 -o 472 -g 472 /mnt/storage/grafana_data
  sudo install -d -m 0775 -o 65534 -g 65534 /mnt/storage/prometheus_data
else
  echo "Warning: /mnt/storage is not mounted; skipping storage directory preparation"
fi

sed \
  -e "s|{{STACK_DIR}}|$REMOTE_STACK_DIR|g" \
  -e "s|{{SERVICE_USER}}|$(id -un)|g" \
  -e "s|{{SERVICE_GROUP}}|$(id -gn)|g" \
  "$SERVICE_TEMPLATE" > "$TMP_SERVICE_FILE"

sudo systemctl enable docker
sudo install -m 0644 "$TMP_SERVICE_FILE" "/etc/systemd/system/$COMPOSE_SERVICE_NAME"
sudo systemctl daemon-reload
sudo systemctl enable --now "$COMPOSE_SERVICE_NAME"
sudo systemctl restart "$COMPOSE_SERVICE_NAME"