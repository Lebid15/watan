param(
  [string]$BindHost = '127.0.0.1',
  [int]$Port = 8000,
  [bool]$SimulateProvider = $true
)

$ErrorActionPreference = 'Stop'

# Move to project root (this script is in djangoo/scripts)
Set-Location -Path (Join-Path $PSScriptRoot '..')

# Activate venv if present
if (Test-Path '.\.venv\Scripts\Activate.ps1') { . .\.venv\Scripts\Activate.ps1 }

# Set required env vars
$env:DJANGO_SETTINGS_MODULE = 'config.settings'
if ($SimulateProvider) { $env:DJ_ZNET_SIMULATE = '1' } else { Remove-Item Env:DJ_ZNET_SIMULATE -ErrorAction SilentlyContinue }

# Prefer venv python if available
$py = 'python'
if (Test-Path '.\.venv\Scripts\python.exe') { $py = '.\.venv\Scripts\python.exe' }

& $py manage.py runserver "$BindHost`:$Port"
