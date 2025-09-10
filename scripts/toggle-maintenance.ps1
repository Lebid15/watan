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

