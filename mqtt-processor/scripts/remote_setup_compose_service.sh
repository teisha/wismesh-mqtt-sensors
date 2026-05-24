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

is_storage_mounted() {
  local target
  target="$(readlink -f /mnt/storage 2>/dev/null || printf %s /mnt/storage)"
  findmnt -T "$target" >/dev/null 2>&1
}

if is_storage_mounted; then
  echo "Detected /mnt/storage mount; preparing Grafana and Prometheus data directories"
  sudo install -d -m 0775 -o 472 -g 472 /mnt/storage/grafana_data
  sudo install -d -m 0775 -o 65534 -g 65534 /mnt/storage/prometheus_data
else
  echo "Storage mount not active yet; attempting to activate /mnt/storage"

  # If fstab uses x-systemd.automount, touching the path can trigger the mount.
  ls -A /mnt/storage >/dev/null 2>&1 || true

  # Try explicit activation paths commonly used on Raspberry Pi hosts.
  sudo mount /mnt/storage >/dev/null 2>&1 || true
  sudo systemctl start mnt-storage.mount >/dev/null 2>&1 || true
  sudo systemctl start mnt-storage.automount >/dev/null 2>&1 || true

  if is_storage_mounted; then
    echo "Detected /mnt/storage mount after activation; preparing directories"
    sudo install -d -m 0775 -o 472 -g 472 /mnt/storage/grafana_data
    sudo install -d -m 0775 -o 65534 -g 65534 /mnt/storage/prometheus_data
  else
    echo "Error: required mount /mnt/storage is still not active"
    echo "This stack requires persistent storage for Grafana and Prometheus."
    echo "Remote diagnostics:"
    echo "  lsblk -f"
    echo "  findmnt -T /mnt/storage"
    echo "  grep -n /mnt/storage /etc/fstab"
    echo "  sudo systemctl status mnt-storage.mount --no-pager"
    echo "  sudo systemctl status mnt-storage.automount --no-pager"
    echo "Fix the host mount, then re-run deploy."
    exit 1
  fi
fi

sed \
  -e "s|{{STACK_DIR}}|$REMOTE_STACK_DIR|g" \
  -e "s|{{SERVICE_USER}}|$(id -un)|g" \
  -e "s|{{SERVICE_GROUP}}|$(id -gn)|g" \
  "$SERVICE_TEMPLATE" > "$TMP_SERVICE_FILE"

sudo systemctl enable docker
sudo install -m 0644 "$TMP_SERVICE_FILE" "/etc/systemd/system/$COMPOSE_SERVICE_NAME"
sudo systemctl daemon-reload
if ! sudo systemctl enable --now "$COMPOSE_SERVICE_NAME"; then
  echo "Error: failed to start $COMPOSE_SERVICE_NAME"
  echo "Recent unit logs:"
  sudo journalctl -u "$COMPOSE_SERVICE_NAME" -n 80 --no-pager || true
  echo "Mount status:"
  findmnt -T /mnt/storage || true
  echo "Hint: check /etc/fstab UUID and device availability"
  exit 1
fi

if ! sudo systemctl restart "$COMPOSE_SERVICE_NAME"; then
  echo "Error: failed to restart $COMPOSE_SERVICE_NAME"
  sudo journalctl -u "$COMPOSE_SERVICE_NAME" -n 80 --no-pager || true
  exit 1
fi