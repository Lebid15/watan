#!/usr/bin/env bash
set -euo pipefail

# restart-backend.sh
# Purpose: Safely recreate the backend container with a stable name (watan-backend),
# waiting for health before returning exit 0.
# Usage: ./scripts/restart-backend.sh [--rebuild] [--no-cache] [--pull]
# Examples:
#   ./scripts/restart-backend.sh --rebuild
#   ./scripts/restart-backend.sh --rebuild --no-cache --pull
#   ./scripts/restart-backend.sh
# Arabic quick help:
#   يعيد تشغيل حاوية الباك إند مع انتظار حالة الصحة. استعمل --rebuild لإعادة البناء.

REBUILD=0
NO_CACHE=0
PULL=0

for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --no-cache) NO_CACHE=1 ;;
    --pull) PULL=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# //'
      exit 0
      ;;
  esac
done

compose_cmd=(docker compose)

if [[ $REBUILD -eq 1 ]]; then
  build_args=(build backend)
  if [[ $PULL -eq 1 ]]; then
    build_args+=(--pull)
  fi
  if [[ $NO_CACHE -eq 1 ]]; then
    build_args+=(--no-cache)
  fi
  echo "[info] Building backend image..." >&2
  "${compose_cmd[@]}" "${build_args[@]}"
fi

# Stop container if exists
if docker ps -a --format '{{.Names}}' | grep -q '^watan-backend$'; then
  echo "[info] Removing existing container 'watan-backend'..." >&2
  docker rm -f watan-backend >/dev/null
fi

# (Re)create in detached mode
echo "[info] Starting backend container..." >&2
"${compose_cmd[@]}" up -d backend

# Wait for health
echo -n "[info] Waiting for healthy status" >&2
for i in {1..40}; do
  status=$(docker inspect -f '{{.State.Health.Status}}' watan-backend 2>/dev/null || echo 'starting')
  if [[ "$status" == "healthy" ]]; then
    echo -e "\n[ok] Backend is healthy." >&2
    exit 0
  fi
  if [[ "$status" == "unhealthy" ]]; then
    echo -e "\n[error] Backend reported unhealthy state." >&2
    docker logs --tail 200 watan-backend >&2 || true
    exit 1
  fi
  echo -n '.' >&2
  sleep 3
done

echo -e "\n[error] Timeout waiting for backend to become healthy." >&2
docker logs --tail 200 watan-backend >&2 || true
exit 1
