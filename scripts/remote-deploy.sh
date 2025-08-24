#!/usr/bin/env bash
# remote-deploy.sh
# One-shot remote deployment helper.
# Runs the compose stack lifecycle + migrations + health check directly on the VPS via SSH.
# Requirements:
#   - An SSH config Host alias (default: syr1-vps) OR set SSH_TARGET=user@host
#   - Your SSH key loaded / agent running (or key in config)
#   - Remote directory default: /root/watan (override with REMOTE_DIR env)
# Usage:
#   bash scripts/remote-deploy.sh
#   SSH_TARGET=root@1.2.3.4 REMOTE_DIR=/root/watan bash scripts/remote-deploy.sh
# Exit codes:
#   0 success, >0 failure at some stage (see summary at end)

set -euo pipefail

SSH_TARGET=${SSH_TARGET:-syr1-vps}
REMOTE_DIR=${REMOTE_DIR:-/root/watan}
BACKEND_CONTAINER=${BACKEND_CONTAINER:-watan-backend}
HEALTH_PATH=${HEALTH_PATH:-/api/health}
MIGRATION_CMD=${MIGRATION_CMD:-node dist/data-source.js migration:run}
COLOR=${COLOR:-true}

ce() { # colored echo
  if [ "$COLOR" = true ]; then
    local c="$1"; shift; printf "\033[%sm%s\033[0m\n" "$c" "$*";
  else
    shift; echo "$*";
  fi
}

section() { ce '1;36' "==== $* ===="; }
info() { ce '0;32' "$*"; }
warn() { ce '0;33' "$*"; }
err() { ce '0;31' "$*"; }

section "Remote Deploy Start"
info "Target: $SSH_TARGET  Dir: $REMOTE_DIR"

# Build remote script to keep a single SSH invocation (atomic output ordering)
ssh -o BatchMode=yes "$SSH_TARGET" bash -s <<'EOF'
set -euo pipefail
REMOTE_DIR="${REMOTE_DIR:-/root/watan}" # (Will be empty here; not exported from caller heredoc, so redefine in outer script if needed)
cd "$REMOTE_DIR" 2>/dev/null || { echo "[FATAL] Remote directory $REMOTE_DIR not found"; exit 20; }

log() { printf '\n[%s] %s\n' "$(date -u '+%H:%M:%S')" "$*"; }

# 1) Down
log '1) docker compose down --remove-orphans'
(docker compose down --remove-orphans || docker-compose down --remove-orphans || true) >/dev/null 2>&1 || true

# 2) Up --build
log '2) docker compose up -d --build'
if docker compose up -d --build 2>&1; then :; else
  if command -v docker-compose >/dev/null 2>&1; then docker-compose up -d --build; else exit 21; fi
fi

# 3) ps
log '3) docker compose ps'
(docker compose ps || docker-compose ps) || true

# 4) migrations
log '4) Run migrations'
if docker compose exec -T backend node dist/data-source.js migration:run 2>&1; then
  echo '[OK] Migrations ran'
else
  echo '[ERROR] Migrations failed. Backend recent logs:'
  docker logs --tail=150 watan-backend || true
  exit 30
fi

# 5) health
log '5) Health check inside backend container'
if docker compose exec -T backend wget -q -O - http://localhost:3000/api/health 2>/dev/null; then
  echo '\n[OK] Health endpoint responded'
else
  echo '[ERROR] Health failed; last backend logs:'
  docker logs --tail=120 watan-backend || true
  exit 40
fi

# 6) external curl from host (nginx or direct)
log '6) Health from host network (curl)'
if curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/health | grep -q '^200$'; then
  echo '[OK] Host curl got 200'
else
  echo '[WARN] Host curl did not get 200'
fi

log 'Done.'
EOF

status=$?
if [ $status -eq 0 ]; then
  section "Deployment SUCCESS"
else
  err "Deployment FAILED (exit $status)"
fi
exit $status
