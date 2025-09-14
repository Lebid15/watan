<#
.SYNOPSIS
  Recreate and wait for healthy backend container (watan-backend).

.DESCRIPTION
  Stops/removes existing `watan-backend` container, optionally rebuilds the image,
  starts it again via `docker compose up -d backend`, and waits until Health=healthy
  or fails with logs. Mirrors the logic of restart-backend.sh for Windows PowerShell users.

.PARAMETER Rebuild
  If provided, triggers `docker compose build backend`.

.PARAMETER NoCache
  With -Rebuild, adds --no-cache to the build.

.PARAMETER Pull
  With -Rebuild, adds --pull to the build (pull newer base layers).

.EXAMPLE
  ./scripts/restart-backend.ps1

.EXAMPLE
  ./scripts/restart-backend.ps1 -Rebuild

.EXAMPLE
  ./scripts/restart-backend.ps1 -Rebuild -NoCache -Pull

.NOTES (Arabic)
  يعيد تشغيل الحاوية ويعيد بناء الصورة حسب الخيارات وينتظر حتى تصبح الحالة صحية.
#>
[CmdletBinding()] param(
  [switch]$Rebuild,
  [switch]$NoCache,
  [switch]$Pull
)

function Write-Info($msg) { Write-Host "[info] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[ok]   $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[error] $msg" -ForegroundColor Red }

$ErrorActionPreference = 'Stop'

# Verify docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Err 'Docker CLI not found in PATH.'
  exit 1
}

if ($Rebuild) {
  $buildArgs = @('compose','build','backend')
  if ($Pull)    { $buildArgs += '--pull' }
  if ($NoCache) { $buildArgs += '--no-cache' }
  Write-Info 'Building backend image...'
  docker @buildArgs
}

# Remove existing container if exists
$existing = docker ps -a --format '{{.Names}}' | Where-Object { $_ -eq 'watan-backend' }
if ($existing) {
  Write-Info 'Removing existing container watan-backend ...'
  docker rm -f watan-backend | Out-Null
}

Write-Info 'Starting backend container...'
docker compose up -d backend | Out-Null

Write-Info 'Waiting for healthy status'
$maxAttempts = 40
for ($i=1; $i -le $maxAttempts; $i++) {
  try {
    $status = docker inspect -f '{{.State.Health.Status}}' watan-backend 2>$null
  } catch {
    $status = 'starting'
  }
  if ($status -eq 'healthy') {
    Write-Ok 'Backend is healthy.'
    exit 0
  }
  if ($status -eq 'unhealthy') {
    Write-Err 'Backend reported unhealthy state.'
    docker logs --tail 200 watan-backend
    exit 1
  }
  Write-Host -NoNewline '.'
  Start-Sleep -Seconds 3
}

Write-Err 'Timeout waiting for backend to become healthy.'
docker logs --tail 200 watan-backend
exit 1
