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

if ! command -v rsync >/dev/null 2>&1; then
  echo "Error: rsync is required but was not found on this machine."
  exit 1
fi

echo "Creating remote app directory: $REMOTE_APP_DIR"
ssh -p "$SSH_PORT" "$REMOTE_HOST" "mkdir -p $REMOTE_APP_DIR"

echo "Syncing app to $REMOTE_HOST:$REMOTE_APP_DIR"
rsync -az --delete \
  --exclude '.git' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.env' \
  -e "ssh -p $SSH_PORT" \
  "$LOCAL_APP_DIR/" "$REMOTE_HOST:$REMOTE_APP_DIR/"

echo "Running remote deploy script"
ssh -p "$SSH_PORT" "$REMOTE_HOST" "bash $REMOTE_APP_DIR/scripts/deploy.sh"

echo "Remote deploy complete: $REMOTE_HOST:$REMOTE_APP_DIR"
