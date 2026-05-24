#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <compose_service_name>"
  exit 1
fi

COMPOSE_SERVICE_NAME="$1"

echo "Unit file:"
sudo ls -l /etc/systemd/system/garden-telemetry.service
echo "Enabled:"
sudo systemctl is-enabled garden-telemetry.service || true
echo "Active:"
sudo systemctl is-active garden-telemetry.service || true

echo "Compose service enabled:"
sudo systemctl is-enabled "$COMPOSE_SERVICE_NAME" || true
echo "Compose service active:"
sudo systemctl is-active "$COMPOSE_SERVICE_NAME" || true
echo "Compose containers:"
if [[ -d "$HOME/telemetry" ]]; then
  cd "$HOME/telemetry" && docker compose ps || true
fi