<#
remote-fast-deploy.ps1
Quick backend-focused remote deploy for Windows PowerShell users.
Requires: ssh configured (key + host), remote dir with repo.
Environment (can set before calling):
  $env:SSH_TARGET (default syr1-vps)
  $env:REMOTE_DIR (default /root/watan)
  $env:SERVICES  (default 'backend')
  $env:BRANCH    (default 'main')
  $env:NO_BUILD  (1 skip build)
  $env:NO_MIGRATIONS (1 skip migrations)
  $env:AUTO_SKIP_UNCHANGED (1 diff last_success commit to skip build)
  $env:BACKEND_PATHS (space separated paths for diff; default backend/ Dockerfile docker-compose.yml)
  $env:MIGRATION_CMD (default node dist/data-source.js migration:run)
  $env:HEALTH_PATH (default /api/health)
#>

$ErrorActionPreference = 'Stop'
function Color($c, $msg){
  Write-Host $msg -ForegroundColor $c
}
function Section($m){ Color Cyan "==== $m ====" }

$SSH_TARGET = $env:SSH_TARGET; if([string]::IsNullOrWhiteSpace($SSH_TARGET)){ $SSH_TARGET = 'syr1-vps' }
$REMOTE_DIR = $env:REMOTE_DIR; if([string]::IsNullOrWhiteSpace($REMOTE_DIR)){ $REMOTE_DIR = '/root/watan' }
$SERVICES   = $env:SERVICES;   if([string]::IsNullOrWhiteSpace($SERVICES)){ $SERVICES = 'backend' }
$BRANCH     = $env:BRANCH;     if([string]::IsNullOrWhiteSpace($BRANCH)){ $BRANCH = 'main' }
$NO_BUILD   = $env:NO_BUILD;   if([string]::IsNullOrWhiteSpace($NO_BUILD)){ $NO_BUILD = '0' }
$NO_MIGRATIONS = $env:NO_MIGRATIONS; if([string]::IsNullOrWhiteSpace($NO_MIGRATIONS)){ $NO_MIGRATIONS = '0' }
$AUTO_SKIP_UNCHANGED = $env:AUTO_SKIP_UNCHANGED; if([string]::IsNullOrWhiteSpace($AUTO_SKIP_UNCHANGED)){ $AUTO_SKIP_UNCHANGED = '0' }
$BACKEND_PATHS = $env:BACKEND_PATHS; if([string]::IsNullOrWhiteSpace($BACKEND_PATHS)){ $BACKEND_PATHS = 'backend/ Dockerfile docker-compose.yml' }
$MIGRATION_CMD = $env:MIGRATION_CMD; if([string]::IsNullOrWhiteSpace($MIGRATION_CMD)){ $MIGRATION_CMD = 'node dist/data-source.js migration:run' }
$HEALTH_PATH = $env:HEALTH_PATH; if([string]::IsNullOrWhiteSpace($HEALTH_PATH)){ $HEALTH_PATH = '/api/health' }
$BACKEND_SERVICE = $env:BACKEND_SERVICE; if([string]::IsNullOrWhiteSpace($BACKEND_SERVICE)){ $BACKEND_SERVICE = 'backend' }
$BACKEND_CONTAINER = $env:BACKEND_CONTAINER; if([string]::IsNullOrWhiteSpace($BACKEND_CONTAINER)){ $BACKEND_CONTAINER = 'watan-backend' }

Section "Fast Remote Deploy"; Color Green "Target: $SSH_TARGET  Dir: $REMOTE_DIR  Services: $SERVICES"

# Remote bash script assembled as single string
$remote = @"
set -euo pipefail
REMOTE_DIR='$REMOTE_DIR'
SERVICES='$SERVICES'
BRANCH='$BRANCH'
NO_BUILD='$NO_BUILD'
NO_MIGRATIONS='$NO_MIGRATIONS'
AUTO_SKIP_UNCHANGED='$AUTO_SKIP_UNCHANGED'
BACKEND_PATHS='$BACKEND_PATHS'
MIGRATION_CMD="$MIGRATION_CMD"
HEALTH_PATH='$HEALTH_PATH'
BACKEND_SERVICE='$BACKEND_SERVICE'
BACKEND_CONTAINER='$BACKEND_CONTAINER'
log(){ printf '\n[%s] %s\n' "$(date -u '+%H:%M:%S')" "$*"; }
fail(){ echo "[FATAL] $*" >&2; exit 90; }
cd "$REMOTE_DIR" 2>/dev/null || fail "Remote dir $REMOTE_DIR not found"
[ -d .git ] || fail "Not a git repo"
log '1) git fetch/reset'
(git fetch origin "$BRANCH" --quiet || git fetch origin "$BRANCH") || fail fetch
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then git checkout "$BRANCH" >/dev/null 2>&1 || git checkout -B "$BRANCH" "origin/$BRANCH"; fi
git reset --hard "origin/$BRANCH" >/dev/null 2>&1 || fail reset
CURRENT_COMMIT=$(git rev-parse --short HEAD)
LAST_FILE=.deploy/last_success; LAST_COMMIT=""; [ -f "$LAST_FILE" ] && LAST_COMMIT=$(cat "$LAST_FILE" || true)
SKIP_BUILD=0
if [ "$AUTO_SKIP_UNCHANGED" = 1 ] && [ -n "$LAST_COMMIT" ]; then
  if git diff --name-only "$LAST_COMMIT" "$CURRENT_COMMIT" -- $BACKEND_PATHS | grep -q .; then log 'Changes -> build needed'; else log 'No changes -> skip build'; SKIP_BUILD=1; fi
fi
[ "$NO_BUILD" = 1 ] && SKIP_BUILD=1
log '2) docker compose pull'
(docker compose pull $SERVICES 2>/dev/null || true)
if [ $SKIP_BUILD -eq 0 ]; then log '3) build'; (docker compose build $SERVICES || docker-compose build $SERVICES) || fail build; else log '3) build skipped'; fi
log '4) up'
(docker compose up -d $SERVICES || docker-compose up -d $SERVICES) || fail up
if [ "$NO_MIGRATIONS" != 1 ]; then log '5) migrations'; if ! docker compose exec -T "$BACKEND_SERVICE" $MIGRATION_CMD; then echo '[ERROR] migrations failed'; docker logs --tail=120 "$BACKEND_CONTAINER" || true; exit 30; fi; else log '5) migrations skipped'; fi
log '6) health'; if docker compose exec -T "$BACKEND_SERVICE" wget -q -O - "http://localhost:3000$HEALTH_PATH" >/dev/null; then echo '[OK] health'; else echo '[ERROR] health failed'; docker logs --tail=80 "$BACKEND_CONTAINER" || true; exit 40; fi
log '7) mark commit'; mkdir -p .deploy; echo "$CURRENT_COMMIT" > "$LAST_FILE"
log "Done fast deploy $CURRENT_COMMIT"
"@

$sshCmd = "ssh -o BatchMode=yes $SSH_TARGET bash -s"

# Prefer local bash if available (Git Bash), else use native PowerShell piping.
try {
  if (Get-Command bash -ErrorAction SilentlyContinue) {
    # Use bash to ensure exact byte output (safer for quoting)
    $out = & bash -lc "printf '%s' '$remote' | $sshCmd" 2>&1
  } else {
    # PowerShell fallback
    $out = $remote | & ssh -o BatchMode=yes $SSH_TARGET bash -s 2>&1
  }
  if ($LASTEXITCODE -eq 0) {
    Section 'Fast Deployment SUCCESS'
    Color Green $out
  } else {
    Section 'Fast Deployment FAILED'
    Color Red $out
    exit 1
  }
} catch {
  Section 'Fast Deployment FAILED'
  Color Red $_.Exception.Message
  exit 1
}
