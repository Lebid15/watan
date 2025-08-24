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

# Early connectivity sanity check
try {
  $test = & ssh -o BatchMode=yes -o ConnectTimeout=5 $SSH_TARGET echo ok 2>&1
  if ($LASTEXITCODE -ne 0 -or -not ($test -match 'ok')) {
    Section 'Fast Deployment FAILED'
    Color Red "لا يمكن الوصول إلى $SSH_TARGET عبر SSH. حدد العنوان مباشرة مثلاً:"
    Color Yellow "مثال:  $env:SSH_TARGET='root@YOUR_SERVER_IP'; .\\scripts\\remote-fast-deploy.ps1"
    Color Yellow "أو اضف alias في %USERPROFILE%\\.ssh\\config مثل:\nHost syr1-vps\n  HostName 1.2.3.4\n  User root\n  IdentityFile ~/.ssh/watan_deploy_ed25519"
    return
  }
} catch {
  Section 'Fast Deployment FAILED'
  Color Red "فشل اختبار SSH المبكر: $_"; return
}

# Remote bash script assembled with placeholders (single-quoted here-string to avoid PowerShell parsing)
$remote = @'
set -euo pipefail
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
log(){ printf "\n[%s] %s\n" "$(date -u '+%H:%M:%S')" "$*"; }
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
'@

# Substitute placeholders safely
$replacements = @{
  '__REMOTE_DIR__'       = $REMOTE_DIR
  '__SERVICES__'         = $SERVICES
  '__BRANCH__'           = $BRANCH
  '__NO_BUILD__'         = $NO_BUILD
  '__NO_MIGRATIONS__'    = $NO_MIGRATIONS
  '__AUTO_SKIP_UNCHANGED__' = $AUTO_SKIP_UNCHANGED
  '__BACKEND_PATHS__'    = $BACKEND_PATHS
  '__MIGRATION_CMD__'    = $MIGRATION_CMD
  '__HEALTH_PATH__'      = $HEALTH_PATH
  '__BACKEND_SERVICE__'  = $BACKEND_SERVICE
  '__BACKEND_CONTAINER__'= $BACKEND_CONTAINER
}
foreach($k in $replacements.Keys){
  $escaped = [Regex]::Escape($k)
  $remote = [Regex]::Replace($remote, $escaped, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) ($replacements[$k] -replace '"','\"') })
}

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
