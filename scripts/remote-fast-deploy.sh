#!/usr/bin/env bash
# remote-fast-deploy.sh
# Faster remote deployment helper focusing on backend (and optionally worker) only.
# Uses a single SSH invocation; lets you skip rebuilding unchanged services.
# Features:
#   - Pull latest main (or chosen branch)
#   - Optional selective build (backend only by default)
#   - Optional migrations run (default on)
#   - Health check
#   - Records last deployed commit hash remotely (.deploy/last_success)
#   - Can skip build if no backend changes since last success (git diff)
#
# Usage examples:
#   bash scripts/remote-fast-deploy.sh                           # backend build+up+migrate+health
#   SERVICES="backend worker" bash scripts/remote-fast-deploy.sh # include worker
#   NO_MIGRATIONS=1 bash scripts/remote-fast-deploy.sh            # skip migrations
#   NO_BUILD=1 bash scripts/remote-fast-deploy.sh                 # just restart / ensure up
#   AUTO_SKIP_UNCHANGED=1 bash scripts/remote-fast-deploy.sh      # skip build if no backend src changes
#   BRANCH=feature/x SERVICES="backend" bash scripts/remote-fast-deploy.sh
#
# Environment variables:
#   SSH_TARGET (default syr1-vps)
#   REMOTE_DIR (default /root/watan)
#   SERVICES   (space separated; default "backend")
#   BRANCH     (default main)
#   NO_BUILD   (1 to skip build phase)
#   NO_MIGRATIONS (1 to skip migrations)
#   AUTO_SKIP_UNCHANGED (1 to diff last_success commit for backend paths)
#   BACKEND_PATHS   (override diff paths; default backend/ Dockerfile* docker-compose.yml)
#   MIGRATION_CMD (default node dist/data-source.js migration:run)
#   HEALTH_PATH (default /api/health)
#   BACKEND_SERVICE (default backend)
#   BACKEND_CONTAINER (default watan-backend)
#   CLEAN_CONFLICTING (1 => remove any stale containers matching backend pattern before up)
#
set -euo pipefail
SSH_TARGET=${SSH_TARGET:-syr1-vps}
REMOTE_DIR=${REMOTE_DIR:-/root/watan}
SERVICES=${SERVICES:-backend}
BRANCH=${BRANCH:-main}
NO_BUILD=${NO_BUILD:-0}
NO_MIGRATIONS=${NO_MIGRATIONS:-0}
AUTO_SKIP_UNCHANGED=${AUTO_SKIP_UNCHANGED:-0}
BACKEND_PATHS=${BACKEND_PATHS:-"backend/ Dockerfile backend/Dockerfile docker-compose.yml"}
MIGRATION_CMD=${MIGRATION_CMD:-node dist/data-source.js migration:run}
HEALTH_PATH=${HEALTH_PATH:-/api/health}
BACKEND_SERVICE=${BACKEND_SERVICE:-backend}
BACKEND_CONTAINER=${BACKEND_CONTAINER:-watan-backend}
CLEAN_CONFLICTING=${CLEAN_CONFLICTING:-0}
COLOR=${COLOR:-true}

ce(){ if [ "$COLOR" = true ]; then printf "\033[%sm%s\033[0m\n" "$1" "$2"; else echo "$2"; fi; }
section(){ ce '1;36' "==== $1 ===="; }
info(){ ce '0;32' "$1"; }
warn(){ ce '0;33' "$1"; }
err(){ ce '0;31' "$1"; }

section "Fast Remote Deploy"; info "Target: $SSH_TARGET  Dir: $REMOTE_DIR  Services: $SERVICES"

# Build remote script
ssh -o BatchMode=yes "$SSH_TARGET" bash -s <<'EOF'
set -euo pipefail
SSH_TARGET_INNER="$SSH_TARGET" # (not actually passed; placeholders)
REMOTE_DIR="${REMOTE_DIR:-/root/watan}" # Not inherited from outer unless exported; rely on default
SERVICES="${SERVICES:-backend}" # placeholder
BRANCH="${BRANCH:-main}"
NO_BUILD="${NO_BUILD:-0}"
NO_MIGRATIONS="${NO_MIGRATIONS:-0}"
AUTO_SKIP_UNCHANGED="${AUTO_SKIP_UNCHANGED:-0}"
BACKEND_PATHS="${BACKEND_PATHS:-backend/ Dockerfile backend/Dockerfile docker-compose.yml}"
MIGRATION_CMD="${MIGRATION_CMD:-node dist/data-source.js migration:run}"
HEALTH_PATH="${HEALTH_PATH:-/api/health}"
BACKEND_SERVICE="${BACKEND_SERVICE:-backend}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-watan-backend}"

log(){ printf '\n[%s] %s\n' "$(date -u '+%H:%M:%S')" "$*"; }
fail(){ echo "[FATAL] $*" >&2; exit 90; }

cd "$REMOTE_DIR" 2>/dev/null || fail "Remote dir $REMOTE_DIR not found"

# Ensure git repo
if [ ! -d .git ]; then fail "Not a git repo: $REMOTE_DIR"; fi

log "1) git fetch & checkout $BRANCH"
(git fetch origin "$BRANCH" --quiet || git fetch origin "$BRANCH") || fail "git fetch failed"
# Prefer reset to remote for deterministic builds
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH" >/dev/null 2>&1 || git checkout -B "$BRANCH" "origin/$BRANCH" || fail "checkout failed"
fi
(git reset --hard "origin/$BRANCH" || fail "git reset failed") >/dev/null 2>&1
CURRENT_COMMIT=$(git rev-parse --short HEAD)
LAST_FILE=.deploy/last_success
LAST_COMMIT=""
[ -f "$LAST_FILE" ] && LAST_COMMIT=$(cat "$LAST_FILE" || true)

SKIP_BUILD=0
if [ "$AUTO_SKIP_UNCHANGED" = 1 ] && [ -n "$LAST_COMMIT" ]; then
  log "Diffing backend paths since $LAST_COMMIT -> $CURRENT_COMMIT"
  # shellcheck disable=SC2086
  if git diff --name-only "$LAST_COMMIT" "$CURRENT_COMMIT" -- $BACKEND_PATHS | grep -q .; then
    log "Changes detected in backend paths -> build needed"
  else
    log "No backend path changes; skipping build"
    SKIP_BUILD=1
  fi
fi

if [ "$NO_BUILD" = 1 ]; then SKIP_BUILD=1; fi

log "2) docker compose pull (fast attempt)"
(docker compose pull $SERVICES 2>/dev/null || true) || true

if [ "$SKIP_BUILD" -eq 0 ]; then
  log "3) docker compose build $SERVICES"
  if ! docker compose build $SERVICES; then
    if command -v docker-compose >/dev/null 2>&1; then docker-compose build $SERVICES; else fail "build failed"; fi
  fi
else
  log "3) build skipped"
fi

log "4) docker compose up -d $SERVICES"
if [ "$CLEAN_CONFLICTING" = 1 ]; then
  log "[cleanup] removing conflicting containers for $BACKEND_CONTAINER"
  # Remove exact named container
  docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
  # Remove any prefixed variants (e.g., hash_watan-backend)
  docker ps -a --format '{{.ID}} {{.Names}}' | awk -v pat="_${BACKEND_CONTAINER}$" '($2 ~ pat){print $1}' | xargs -r docker rm -f || true
fi

if ! docker compose up -d $SERVICES; then
  if command -v docker-compose >/dev/null 2>&1; then docker-compose up -d $SERVICES; else fail "up failed"; fi
fi

if [ "$NO_MIGRATIONS" != 1 ]; then
  log "5) migrations ($MIGRATION_CMD)"
  if ! docker compose exec -T "$BACKEND_SERVICE" $MIGRATION_CMD; then
    echo "[ERROR] migrations failed" >&2
    docker logs --tail=120 "$BACKEND_CONTAINER" || true
    exit 30
  fi
else
  log "5) migrations skipped"
fi

log "6) health check inside backend"
if docker compose exec -T "$BACKEND_SERVICE" wget -q -O - "http://localhost:3000$HEALTH_PATH" >/dev/null; then
  echo "[OK] health"
else
  echo "[ERROR] health failed (inside)" >&2
  docker logs --tail=120 "$BACKEND_CONTAINER" || true
  exit 40
fi

log "7) mark success commit $CURRENT_COMMIT"
mkdir -p .deploy
printf '%s\n' "$CURRENT_COMMIT" > "$LAST_FILE"

log "Done fast deploy commit $CURRENT_COMMIT"
EOF

status=$?
if [ $status -eq 0 ]; then
  section "Fast Deployment SUCCESS"
else
  err "Fast Deployment FAILED (exit $status)"
fi
exit $status
