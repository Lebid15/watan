# Runs end-to-end local flow as requested (Windows PowerShell)
param(
  [string]$TenantHost = 'localhost',
  [string]$BaseUrl = 'http://127.0.0.1:8000/api-dj',
  [bool]$SimulateProvider = $true
)

$ErrorActionPreference = 'Stop'

# Move to project root (script is in djangoo/scripts)
Set-Location -Path (Join-Path $PSScriptRoot '..')

# Activate venv
if (Test-Path '.\.venv\Scripts\Activate.ps1') { . .\.venv\Scripts\Activate.ps1 }
$env:DJANGO_SETTINGS_MODULE = 'config.settings'
if ($SimulateProvider) { $env:DJ_ZNET_SIMULATE = '1' } else { Remove-Item Env:DJ_ZNET_SIMULATE -ErrorAction SilentlyContinue }

# 0) Ensure dev server is running; try health, else start and wait
$healthUrl = "$BaseUrl/health"
function Test-Health { param([string]$url) try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true } catch { return $false } }
if (-not (Test-Health -url $healthUrl)) {
  Write-Host "Dev server not responding, starting it..."
  $serverScript = Join-Path $PSScriptRoot 'runserver_local.ps1'
  Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$serverScript`"" -WindowStyle Minimized | Out-Null
  $retries = 30
  while ($retries -gt 0 -and -not (Test-Health -url $healthUrl)) { Start-Sleep -Seconds 1; $retries-- }
  if (-not (Test-Health -url $healthUrl)) { throw "Dev server failed to start at $healthUrl" }
}

# 1) Ensure tenant mapping
$tenantId = (& python manage.py ensure_local_host $TenantHost)
if (-not $tenantId) { throw 'Failed to resolve tenantId' }

# 2) Ensure local admin with api_token
$out = & python manage.py ensure_local_admin
$apiToken = ($out | Select-String -Pattern 'API_TOKEN=').ToString().Split('=')[-1]
if (-not $apiToken) { throw 'Failed to get API token' }

# 3) Ensure Znet integration (create or fetch)
try {
  $createOut = (& python manage.py create_integration --tenant-id $tenantId --name 'Znet Local' --provider znet --scope tenant --base-url 'http://localhost:9999/servis' --kod 'dev' --sifre 'dev' --enabled) | ForEach-Object { $_ }
} catch {
  $createOut = ''
}
$integId = ''
if ($createOut) {
  $integId = ($createOut | Select-String -Pattern 'Integration created: ').ToString().Split(':')[-1].Trim()
}
if (-not $integId) {
  $lookupOut = (& python manage.py get_integration_id --tenant-id $tenantId --name 'Znet Local') | ForEach-Object { $_ }
  $integId = ($lookupOut | Select-String -Pattern 'INTEGRATION_ID=').ToString().Split('=')[-1].Trim()
}
if (-not $integId) { throw 'Failed to get integration id' }

# 4) Import catalog with apply+applyCosts (may be zero in simulate)
$hdrs = @{ 'X-Tenant-Host' = $TenantHost; 'X-Tenant-Id' = $tenantId; 'X-API-Token' = $apiToken }
$url = "$BaseUrl/admin/integrations/$integId/import-catalog?apply=1&applyCosts=1&currency=USD"
try { $resp = Invoke-WebRequest -Uri $url -Headers $hdrs -Method POST -UseBasicParsing } catch { $resp = $_.Exception.Response }
$importStatus = if ($resp) { [int]$resp.StatusCode } else { -1 }

# 5) Ensure pending order and get package id (seed product if needed)
$orderOut = & python manage.py ensure_pending_order --tenant-id $tenantId
if (-not $orderOut -or ($orderOut | Select-String -Pattern 'No product/package')) {
  & python manage.py seed_local_product --tenant-id $tenantId | Out-Null
  $orderOut = & python manage.py ensure_pending_order --tenant-id $tenantId
}
$orderId = ($orderOut | Select-String -Pattern 'ORDER_ID=').ToString().Split('=')[-1]
$pkgId = ($orderOut | Select-String -Pattern 'PACKAGE_ID=').ToString().Split('=')[-1]
if (-not $pkgId) {
  # fallback: try coverage
  try { $cov = Invoke-RestMethod -Uri ("$BaseUrl/admin/providers/coverage?providerId=$integId") -Headers $hdrs -Method GET } catch { $cov = $null }
  if ($cov) { $pkgId = $cov.items | Select-Object -First 1 -ExpandProperty packageId }
}
if (-not $pkgId) { throw 'No packageId found' }
# Ensure mapping + routing for this package to provider
& python manage.py ensure_mapping_routing --tenant-id $tenantId --package-id $pkgId --provider-id $integId --provider-package-id 1001 | Out-Null

# 7) Sync external
$syncUrl = "$BaseUrl/admin/orders/$orderId/sync-external"
$syncResp = Invoke-WebRequest -Uri $syncUrl -Headers $hdrs -Method PATCH -UseBasicParsing
$syncCode = [int]$syncResp.StatusCode

# 8) Refresh external
$refUrl = "$BaseUrl/admin/orders/$orderId/refresh-external"
$refResp = Invoke-WebRequest -Uri $refUrl -Headers $hdrs -Method POST -UseBasicParsing
$refCode = [int]$refResp.StatusCode
$refBody = $refResp.Content | ConvertFrom-Json
$pin = $refBody.order.pinCode
$extStatus = $refBody.order.externalStatus

# 9) Poller once
python manage.py poll_external_orders --tenant-id $tenantId --limit 10 | Out-Null

Write-Host "SUMMARY: import=$importStatus sync=$syncCode refresh=$refCode orderId=$orderId externalStatus=$extStatus pin=$pin"
