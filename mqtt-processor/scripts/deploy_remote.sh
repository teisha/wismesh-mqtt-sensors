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
COMPOSE_SERVICE_NAME="garden-telemetry-compose.service"
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

echo "Ensuring docker compose stack service is installed and enabled"
ssh -tt "${SSH_OPTS[@]}" "$REMOTE_HOST" '
  set -euo pipefail
  REMOTE_HOME="$(printf %s "$HOME")"
  REMOTE_APP_DIR="$REMOTE_HOME/mqtt-processor"
  REMOTE_STACK_DIR="$REMOTE_HOME/telemetry"
  SERVICE_TEMPLATE="$REMOTE_APP_DIR/systemd/'"$COMPOSE_SERVICE_NAME"'"
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

  sed \
    -e "s|{{STACK_DIR}}|$REMOTE_STACK_DIR|g" \
    -e "s|{{SERVICE_USER}}|$(id -un)|g" \
    -e "s|{{SERVICE_GROUP}}|$(id -gn)|g" \
    "$SERVICE_TEMPLATE" > "$TMP_SERVICE_FILE"

  sudo systemctl enable docker
  sudo install -m 0644 "$TMP_SERVICE_FILE" /etc/systemd/system/'"$COMPOSE_SERVICE_NAME"'
  sudo systemctl daemon-reload
  sudo systemctl enable --now '"$COMPOSE_SERVICE_NAME"'
  sudo systemctl restart '"$COMPOSE_SERVICE_NAME"'
'

echo "Verifying remote system service"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" '
  echo "Unit file:";
  sudo ls -l /etc/systemd/system/garden-telemetry.service;
  echo "Enabled:";
  sudo systemctl is-enabled garden-telemetry.service || true;
  echo "Active:";
  sudo systemctl is-active garden-telemetry.service || true
'

echo "Verifying compose stack service"
ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" '
  echo "Compose service enabled:";
  sudo systemctl is-enabled '"$COMPOSE_SERVICE_NAME"' || true;
  echo "Compose service active:";
  sudo systemctl is-active '"$COMPOSE_SERVICE_NAME"' || true;
  echo "Compose containers:";
  if [ -d ~/telemetry ]; then
    cd ~/telemetry && docker compose ps || true;
  fi
'

echo "Remote deploy complete: $REMOTE_HOST:$REMOTE_APP_DIR"
