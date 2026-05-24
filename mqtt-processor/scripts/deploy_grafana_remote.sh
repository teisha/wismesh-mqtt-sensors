#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy_grafana_remote.sh <user@pi-host> [ssh_port]
# Example: ./deploy_grafana_remote.sh pi@raspberrypi.local
# Example with custom port: ./deploy_grafana_remote.sh pi@192.168.1.50 2222

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <user@pi-host> [ssh_port]"
  exit 1
fi

REMOTE_HOST="$1"
SSH_PORT="${2:-22}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REMOTE_STACK_DIR="~/telemetry"

# Keep ControlPath short enough for Unix domain socket limits.
CONTROL_ID="$(printf '%s:%s:%s' "$REMOTE_HOST" "$SSH_PORT" "$USER" | sha1sum | cut -c1-10)"
CONTROL_PATH="/tmp/ssh_mux_${CONTROL_ID}_${$}"

cleanup() {
  ssh -p "$SSH_PORT" -o ControlPath="$CONTROL_PATH" -O exit "$REMOTE_HOST" >/dev/null 2>&1 || true
  rm -f "$CONTROL_PATH"
}
trap cleanup EXIT

SSH_OPTS=(
  -p "$SSH_PORT"
  -o ControlMaster=auto
  -o ControlPersist=10m
  -o ControlPath="$CONTROL_PATH"
)

RSYNC_SSH="ssh -p $SSH_PORT -o ControlMaster=auto -o ControlPersist=10m -o ControlPath=$CONTROL_PATH"

if ! command -v rsync >/dev/null 2>&1; then
  echo "Error: rsync is required but was not found on this machine."
  exit 1
fi

echo "Opening shared SSH connection (you should authenticate once)"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" -Nf

echo "Ensuring remote stack directories exist"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "mkdir -p $REMOTE_STACK_DIR/grafana/provisioning $REMOTE_STACK_DIR/grafana/dashboards $REMOTE_STACK_DIR/telemetry"

echo "Syncing docker-compose and telemetry config"
rsync -az \
  -e "$RSYNC_SSH" \
  "$REPO_ROOT/docker-compose.yaml" "$REMOTE_HOST:$REMOTE_STACK_DIR/docker-compose.yaml"

rsync -az --delete \
  -e "$RSYNC_SSH" \
  "$REPO_ROOT/telemetry/" "$REMOTE_HOST:$REMOTE_STACK_DIR/telemetry/"

echo "Syncing Grafana provisioning and dashboard JSON files"
rsync -az --delete \
  -e "$RSYNC_SSH" \
  "$REPO_ROOT/grafana/provisioning/" "$REMOTE_HOST:$REMOTE_STACK_DIR/grafana/provisioning/"

rsync -az --delete \
  -e "$RSYNC_SSH" \
  "$REPO_ROOT/grafana/dashboards/" "$REMOTE_HOST:$REMOTE_STACK_DIR/grafana/dashboards/"

echo "Ensuring persistent Grafana data directory permissions on remote host"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" '
  sudo mkdir -p /mnt/storage/grafana_data
  sudo chown -R 472:472 /mnt/storage/grafana_data
'

echo "Recreating Grafana service on remote host"
ssh -tt "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_STACK_DIR && docker compose up -d --force-recreate grafana"

echo "Grafana deploy complete. Recent logs:"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_STACK_DIR && docker compose logs grafana --tail=60"
