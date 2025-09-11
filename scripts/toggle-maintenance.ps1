Param(
  [Parameter(Mandatory=$true)][ValidateSet('on','off')][string]$Mode
)
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$src = Join-Path $Root "nginx/mode.$Mode.conf"
$dest = Join-Path $Root "nginx/mode.conf"
if (-not (Test-Path $src)) { Write-Error "Missing $src"; exit 1 }
Copy-Item $src $dest -Force
Write-Host "Updated mode.conf =>" (Get-Content $dest | Select-String maintenance_switch).Line
try {
  docker compose exec nginx nginx -t | Out-Null
  docker compose exec nginx nginx -s reload | Out-Null
  Write-Host "Reloaded nginx (maintenance $Mode)"
} catch {
  Write-Warning "Docker exec failed, only file replaced. $_"
}
param(
  [ValidateSet('on','off')]
  [string]$mode,
  [string]$message = 'يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.'
)

# Update .env MAINTENANCE and MAINTENANCE_MESSAGE
$envPath = Join-Path $PSScriptRoot '..' '.env'
if (Test-Path $envPath) {
  $content = Get-Content $envPath -Raw
  if ($content -match "(?m)^MAINTENANCE=") {
    $content = [Regex]::Replace($content, "(?m)^MAINTENANCE=.*$", "MAINTENANCE=$mode")
  } else { $content += "`nMAINTENANCE=$mode" }
  if ($content -match "(?m)^MAINTENANCE_MESSAGE=") {
    $content = [Regex]::Replace($content, "(?m)^MAINTENANCE_MESSAGE=.*$", "MAINTENANCE_MESSAGE=$message")
  } else { $content += "`nMAINTENANCE_MESSAGE=$message" }
  Set-Content -Path $envPath -Value $content -Encoding UTF8
} else {
  "MAINTENANCE=$mode`nMAINTENANCE_MESSAGE=$message" | Set-Content -Path $envPath -Encoding UTF8
}

Write-Host "Updated .env: MAINTENANCE=$mode"

