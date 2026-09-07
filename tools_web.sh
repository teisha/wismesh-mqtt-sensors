#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yaml"

usage() {
  cat <<'EOF'
Usage: ./tools_web.sh <build|tdr|up|down|restart|logs|ps> [api|web]

Commands:
  build    Build tools website containers
  tdr      Stop selected containers, rebuild, then recreate/start them
  up       Start selected containers in detached mode
  down     Stop selected containers (does not remove)
  restart  Restart selected containers
  logs     Show recent logs for selected containers
  ps       Show container status for selected containers

Targets:
  api      tools-api only
  web      tools-ui only
  omitted  both tools-api and tools-ui

Examples:
    ./tools_web.sh build
    ./tools_web.sh up
    ./tools_web.sh down
    ./tools_web.sh tdr
    ./tools_web.sh build api
    ./tools_web.sh build web
    ./tools_web.sh up api
    ./tools_web.sh down web
    ./tools_web.sh restart api
    ./tools_web.sh logs web
    ./tools_web.sh ps
EOF
}
# Then test in browser: http://localhost:8088
# To test API health:  curl http://localhost:4000/health
# To get logs: docker compose logs tools-api --tail=20

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

resolve_services() {
  local target="${1:-all}"

  case "$target" in
    all)
      SERVICES=(tools-api tools-ui)
      ;;
    api)
      SERVICES=(tools-api)
      ;;
    web|ui)
      SERVICES=(tools-ui)
      ;;
    *)
      echo "Unknown target: $target" >&2
      usage
      exit 1
      ;;
  esac
}

stop_only() {
  if [[ ${#SERVICES[@]} -eq 0 ]]; then
    return
  fi

  compose stop "${SERVICES[@]}" || true
}

COMMAND="${1:-}"
TARGET="${2:-all}"

if [[ -z "$COMMAND" ]]; then
  usage
  exit 1
fi

resolve_services "$TARGET"

case "$COMMAND" in
  build)
    compose build "${SERVICES[@]}"
    ;;
  tdr)
    stop_only
    compose build "${SERVICES[@]}"
    compose up -d --force-recreate "${SERVICES[@]}"
    ;;
  up)
    compose up -d "${SERVICES[@]}"
    ;;
  down)
    stop_only
    ;;
  restart)
    compose restart "${SERVICES[@]}"
    ;;
  logs)
    compose logs --tail=50 "${SERVICES[@]}"
    ;;
  ps)
    compose ps "${SERVICES[@]}"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    usage
    exit 1
    ;;
esac