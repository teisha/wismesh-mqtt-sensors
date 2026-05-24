#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy_grafana_remote.sh <user@pi-host> [ssh_port] [--no-delete]
# Example: ./deploy_grafana_remote.sh pi@raspberrypi.local
# Example with custom port: ./deploy_grafana_remote.sh pi@192.168.1.50 2222
# Example preserving remote-only files: ./deploy_grafana_remote.sh pi@raspberrypi.local --no-delete

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <user@pi-host> [ssh_port] [--no-delete]"
  exit 1
fi

REMOTE_HOST=""
SSH_PORT="22"
NO_DELETE=0
PORT_SET=0
HOST_SET=0

for arg in "$@"; do
  case "$arg" in
    --no-delete)
      NO_DELETE=1
      ;;
    --*)
      echo "Error: unrecognized flag '$arg'"
      echo "Usage: $0 <user@pi-host> [ssh_port] [--no-delete]"
      exit 1
      ;;
    ''|*[!0-9]*)
      if [[ $HOST_SET -eq 1 ]]; then
        echo "Error: multiple host values provided ('$REMOTE_HOST' and '$arg')"
        echo "Usage: $0 <user@pi-host> [ssh_port] [--no-delete]"
        exit 1
      fi
      REMOTE_HOST="$arg"
      HOST_SET=1
      ;;
    *)
      if [[ $PORT_SET -eq 1 ]]; then
        echo "Error: only one ssh_port value is allowed"
        echo "Usage: $0 <user@pi-host> [ssh_port] [--no-delete]"
        exit 1
      fi
      SSH_PORT="$arg"
      PORT_SET=1
      ;;
  esac
done

if [[ $HOST_SET -eq 0 ]]; then
  echo "Error: missing <user@pi-host>"
  echo "Usage: $0 <user@pi-host> [ssh_port] [--no-delete]"
  exit 1
fi

RSYNC_DELETE_OPTS=(--delete)
if [[ $NO_DELETE -eq 1 ]]; then
  RSYNC_DELETE_OPTS=()
fi

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

rsync -az "${RSYNC_DELETE_OPTS[@]}" \
  -e "$RSYNC_SSH" \
  "$REPO_ROOT/telemetry/" "$REMOTE_HOST:$REMOTE_STACK_DIR/telemetry/"

echo "Syncing Grafana provisioning and dashboard JSON files"
rsync -az "${RSYNC_DELETE_OPTS[@]}" \
  -e "$RSYNC_SSH" \
  "$REPO_ROOT/grafana/provisioning/" "$REMOTE_HOST:$REMOTE_STACK_DIR/grafana/provisioning/"

rsync -az "${RSYNC_DELETE_OPTS[@]}" \
  -e "$RSYNC_SSH" \
  "$REPO_ROOT/grafana/dashboards/" "$REMOTE_HOST:$REMOTE_STACK_DIR/grafana/dashboards/"

echo "Ensuring persistent Grafana data directory permissions on remote host"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" '
  sudo mkdir -p /mnt/storage/grafana_data
  current_owner="$(sudo stat -c '%u:%g' /mnt/storage/grafana_data 2>/dev/null || echo unknown)"
  if [ "$current_owner" != "472:472" ]; then
    sudo chown -R 472:472 /mnt/storage/grafana_data
  fi
'

echo "Updating Grafana service on remote host"
ssh -tt "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_STACK_DIR && docker compose up -d grafana"

echo "Grafana deploy complete. Recent logs:"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "cd $REMOTE_STACK_DIR && docker compose logs grafana --tail=60"
