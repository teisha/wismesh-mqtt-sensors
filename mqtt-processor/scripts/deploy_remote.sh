#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy_remote.sh <user@pi-host> [ssh_port]
# Example: ./deploy_remote.sh pi@raspberrypi.local
# Example with custom port: ./deploy_remote.sh pi@192.168.1.50 2222

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <user@pi-host> [ssh_port]"
  exit 1
fi

REMOTE_HOST="$1"
SSH_PORT="${2:-22}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE_APP_DIR="~/mqtt-processor"
CONTROL_DIR="$(mktemp -d)"
CONTROL_PATH="$CONTROL_DIR/ssh_mux_%h_%p_%r"

cleanup() {
  ssh -p "$SSH_PORT" -o ControlPath="$CONTROL_PATH" -O exit "$REMOTE_HOST" >/dev/null 2>&1 || true
  rm -rf "$CONTROL_DIR"
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

echo "Creating remote app directory: $REMOTE_APP_DIR"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "mkdir -p $REMOTE_APP_DIR"

REMOTE_ENV_FILE="~/.config/garden-telemetry.env"
LOCAL_ENV_FILE="$LOCAL_APP_DIR/config/garden-telemetry.env"

echo "Syncing app to $REMOTE_HOST:$REMOTE_APP_DIR"
rsync -az --delete \
  --exclude '.git' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude 'tests/' \
  --exclude '.pytest_cache/' \
  --exclude 'pytest.ini' \
  --exclude 'requirements-dev.txt' \
  --exclude 'config/garden-telemetry.env' \
  --exclude '.env' \
  -e "$RSYNC_SSH" \
  "$LOCAL_APP_DIR/" "$REMOTE_HOST:$REMOTE_APP_DIR/"

if [[ -f "$LOCAL_ENV_FILE" ]]; then
  echo "Copying optional env file to $REMOTE_HOST:$REMOTE_ENV_FILE"
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "mkdir -p ~/.config"
  scp \
    -P "$SSH_PORT" \
    -o ControlMaster=auto \
    -o ControlPersist=10m \
    -o ControlPath="$CONTROL_PATH" \
    "$LOCAL_ENV_FILE" "$REMOTE_HOST:$REMOTE_ENV_FILE"
fi

echo "Running remote deploy script"
ssh -tt "${SSH_OPTS[@]}" "$REMOTE_HOST" "bash $REMOTE_APP_DIR/scripts/deploy.sh"

echo "Verifying remote system service"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" '
  echo "Unit file:";
  sudo ls -l /etc/systemd/system/garden-telemetry.service;
  echo "Enabled:";
  sudo systemctl is-enabled garden-telemetry.service || true;
  echo "Active:";
  sudo systemctl is-active garden-telemetry.service || true
'

echo "Remote deploy complete: $REMOTE_HOST:$REMOTE_APP_DIR"
