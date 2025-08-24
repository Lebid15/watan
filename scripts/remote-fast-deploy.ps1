<#
remote-fast-deploy.ps1
Fast backend-focused remote deploy (Windows PowerShell).

Environment variables (optional):
  SSH_TARGET           (ex: root@1.2.3.4) default: syr1-vps
  SSH_KEY              (ex: C:\Users\YOU\.ssh\watan_hetzner)
  REMOTE_DIR           default /root/watan
  SERVICES             default backend  (space separated)
  BRANCH               default main
  NO_BUILD             1 = skip build
  NO_MIGRATIONS        1 = skip migrations
  AUTO_SKIP_UNCHANGED  1 = skip backend build if unchanged since last deploy
  BACKEND_PATHS        default: backend/ Dockerfile docker-compose.yml
  MIGRATION_CMD        default: node dist/data-source.js migration:run
  HEALTH_PATH          default: /api/health
  BACKEND_SERVICE      default: backend
  BACKEND_CONTAINER    default: watan-backend
  DEBUG                1 = set -x inside remote script

Usage examples:
  powershell -ExecutionPolicy Bypass -File scripts/remote-fast-deploy.ps1
  $env:SSH_TARGET='root@IP'; $env:SSH_KEY="$env:USERPROFILE\.ssh\watan_hetzner"; scripts/remote-fast-deploy.ps1
  $env:AUTO_SKIP_UNCHANGED=1; scripts/remote-fast-deploy.ps1
  $env:NO_BUILD=1; $env:NO_MIGRATIONS=1; scripts/remote-fast-deploy.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Color($c, $msg){ Write-Host $msg -ForegroundColor $c }
function Section($m){ Color Cyan "==== $m ====" }

function Default($value, $fallback){ if([string]::IsNullOrWhiteSpace($value)){ return $fallback } return $value }
$SSH_TARGET        = Default $env:SSH_TARGET 'syr1-vps'
$REMOTE_DIR        = Default $env:REMOTE_DIR '/root/watan'
$SERVICES          = Default $env:SERVICES 'backend'
$BRANCH            = Default $env:BRANCH 'main'
$NO_BUILD          = Default $env:NO_BUILD '0'
$NO_MIGRATIONS     = Default $env:NO_MIGRATIONS '0'
$AUTO_SKIP_UNCHANGED = Default $env:AUTO_SKIP_UNCHANGED '0'
$BACKEND_PATHS     = Default $env:BACKEND_PATHS 'backend/ Dockerfile docker-compose.yml'
$MIGRATION_CMD     = Default $env:MIGRATION_CMD 'node dist/data-source.js migration:run'
$HEALTH_PATH       = Default $env:HEALTH_PATH '/api/health'
$BACKEND_SERVICE   = Default $env:BACKEND_SERVICE 'backend'
$BACKEND_CONTAINER = Default $env:BACKEND_CONTAINER 'watan-backend'
$DEBUG             = Default $env:DEBUG '0'

Section "Fast Remote Deploy"; Color Green "Target: $SSH_TARGET  Dir: $REMOTE_DIR  Services: $SERVICES"

# ---- Early SSH connectivity test ----
try {
  $sshArgs = @('-o','BatchMode=yes','-o','ConnectTimeout=5')
  if ($env:SSH_KEY -and (Test-Path $env:SSH_KEY)) { $sshArgs += @('-i', $env:SSH_KEY) }
  $sshArgs += $SSH_TARGET
  $probe = (& ssh @sshArgs echo __ssh_ok__) 2>&1
  if ($LASTEXITCODE -ne 0 -or ($probe -notmatch '__ssh_ok__')) {
    Section 'Fast Deployment FAILED'
    Color Red "SSH connect failed for $SSH_TARGET"
    Color Yellow "Raw output: $probe"
    Color Yellow "Set SSH_TARGET directly (ex): $env:SSH_TARGET='root@IP'"
    Color Yellow "Optional key:   $env:SSH_KEY=$env:USERPROFILE\.ssh\watan_hetzner"
    return
  }
} catch {
  Section 'Fast Deployment FAILED'
  Color Red "Early SSH test exception: $_"
  return
}

# ---- Remote bash script (executed on server) ----
$remote = @'
set -euo pipefail 2>/dev/null || set -eu
REMOTE_DIR="__REMOTE_DIR__"
SERVICES="__SERVICES__"
BRANCH="__BRANCH__"
NO_BUILD="__NO_BUILD__"
NO_MIGRATIONS="__NO_MIGRATIONS__"
AUTO_SKIP_UNCHANGED="__AUTO_SKIP_UNCHANGED__"
BACKEND_PATHS="__BACKEND_PATHS__"
MIGRATION_CMD="__MIGRATION_CMD__"
HEALTH_PATH="__HEALTH_PATH__"
BACKEND_SERVICE="__BACKEND_SERVICE__"
BACKEND_CONTAINER="__BACKEND_CONTAINER__"
DEBUG_FLAG="__DEBUG__"

log(){ printf "\n[%s] %s\n" "$(date -u '+%H:%M:%S')" "$*"; }
[ "$DEBUG_FLAG" = "1" ] && set -x

fail(){ echo "[FATAL] $*" >&2; exit 90; }

# Detect docker compose implementation
if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    _dc(){ docker compose "$@"; }
  elif command -v docker-compose >/dev/null 2>&1; then
    _dc(){ docker-compose "$@"; }
  else
    echo "[FATAL] docker compose / docker-compose not found" >&2; exit 91
  fi
else
  echo "[FATAL] docker not installed" >&2; exit 92
fi

cd "$REMOTE_DIR" 2>/dev/null || fail "Remote dir $REMOTE_DIR not found"
[ -d .git ] || fail "Not a git repo"

log '1) git fetch/reset'
(git fetch origin "$BRANCH" --quiet || git fetch origin "$BRANCH") || fail "git fetch"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH" >/dev/null 2>&1 || git checkout -B "$BRANCH" "origin/$BRANCH"
fi
git reset --hard "origin/$BRANCH" >/dev/null 2>&1 || fail "git reset"

CURRENT_COMMIT=$(git rev-parse --short HEAD)
LAST_FILE=.deploy/last_success
LAST_COMMIT=""
[ -f "$LAST_FILE" ] && LAST_COMMIT=$(cat "$LAST_FILE" || true)

SKIP_BUILD=0
if [ "$AUTO_SKIP_UNCHANGED" = "1" ] && [ -n "$LAST_COMMIT" ]; then
  if git diff --name-only "$LAST_COMMIT" "$CURRENT_COMMIT" -- $BACKEND_PATHS | grep -q .; then
    log 'Changes detected -> build needed'
  else
    log 'No backend changes -> skip build'
    SKIP_BUILD=1
  fi
fi
[ "$NO_BUILD" = "1" ] && SKIP_BUILD=1

log '2) pull images'
(_dc pull $SERVICES 2>/dev/null || true)

if [ $SKIP_BUILD -eq 0 ]; then
  log '3) build'
  (_dc build $SERVICES) || fail "build"
else
  log '3) build skipped'
fi

log '4) up'
(_dc up -d $SERVICES) || fail "up"

if [ "$NO_MIGRATIONS" != "1" ]; then
  log '5) migrations'
  if ! (_dc exec -T "$BACKEND_SERVICE" $MIGRATION_CMD); then
    echo '[ERROR] migrations failed'
    (docker logs --tail=120 "$BACKEND_CONTAINER" || true)
    exit 30
  fi
else
  log '5) migrations skipped'
fi

log '6) health'
if (_dc exec -T "$BACKEND_SERVICE" wget -q -O - "http://localhost:3000$HEALTH_PATH" >/dev/null 2>&1); then
  echo '[OK] health'
else
  echo '[ERROR] health failed'
  (docker logs --tail=80 "$BACKEND_CONTAINER" || true)
  exit 40
fi

log '7) mark commit'
mkdir -p .deploy
echo "$CURRENT_COMMIT" > "$LAST_FILE"

log "Done fast deploy $CURRENT_COMMIT"
'@

## Placeholder replacement
$replacements = @{
  '__REMOTE_DIR__'          = $REMOTE_DIR
  '__SERVICES__'            = $SERVICES
  '__BRANCH__'              = $BRANCH
  '__NO_BUILD__'            = $NO_BUILD
  '__NO_MIGRATIONS__'       = $NO_MIGRATIONS
  '__AUTO_SKIP_UNCHANGED__' = $AUTO_SKIP_UNCHANGED
  '__BACKEND_PATHS__'       = $BACKEND_PATHS
  '__MIGRATION_CMD__'       = $MIGRATION_CMD
  '__HEALTH_PATH__'         = $HEALTH_PATH
  '__BACKEND_SERVICE__'     = $BACKEND_SERVICE
  '__BACKEND_CONTAINER__'   = $BACKEND_CONTAINER
  '__DEBUG__'               = $DEBUG
}

foreach($k in $replacements.Keys){
  $escaped = [Regex]::Escape($k)
  $remote = [Regex]::Replace(
    $remote,
    $escaped,
    [System.Text.RegularExpressions.MatchEvaluator]{ param($m) ($replacements[$k] -replace '"','\"') }
  )
}

## Send remote script via SSH
try {
  $args = @('-o','BatchMode=yes')
  if ($env:SSH_KEY -and (Test-Path $env:SSH_KEY)) { $args += @('-i', $env:SSH_KEY) }
  $args += @($SSH_TARGET, 'bash -s')
  $remoteLF = $remote -replace "`r",""
  $out = $remoteLF | & ssh @args 2>&1

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
