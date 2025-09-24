# Local poller schedule (disabled by default)
# Usage: Run manually in PowerShell to poll external orders periodically in this session.
# It does NOT install a Windows Scheduled Task; it only loops in the current shell.
# Configure environment as needed, then start the loop.

param(
    [int]$IntervalSeconds = 60,
    [string]$TenantHost = "local.wtn4.com"
)

$ErrorActionPreference = 'Stop'

Write-Host "Starting local poller loop. Interval: $IntervalSeconds seconds. Press Ctrl+C to stop."

# Activate venv if present
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$djangoo = Join-Path $repo 'djangoo'
$venvAct = Join-Path $djangoo '.venv\Scripts\Activate.ps1'
if (Test-Path $venvAct) { . $venvAct }

# Set DJANGO settings
$env:DJANGO_SETTINGS_MODULE = 'config.settings'

while ($true) {
  try {
    Set-Location -Path $djangoo
    # Ensure tenant exists (idempotent)
  python manage.py ensure_local_host $TenantHost | Out-Null
    # Poll one cycle
    python manage.py poll_external_orders -h $TenantHost | Write-Host
  } catch {
    Write-Warning $_
  }
  Start-Sleep -Seconds $IntervalSeconds
}
