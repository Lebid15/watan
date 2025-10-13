# ==============================================
#  Start Celery Worker ONLY
#  Watch this window for order status checks!
# ==============================================

Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "                      CELERY WORKER - ORDER STATUS MONITORING" -ForegroundColor Green
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "WATCH THIS WINDOW! You will see:" -ForegroundColor Yellow
Write-Host "  - Order status checks every 10 seconds" -ForegroundColor Cyan
Write-Host "  - Provider responses (pending/completed/cancelled)" -ForegroundColor Cyan
Write-Host "  - Status updates" -ForegroundColor Cyan
Write-Host ""
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Redis is running
$redisProcess = Get-Process -Name "redis-server" -ErrorAction SilentlyContinue
if (-not $redisProcess) {
    Write-Host "WARNING: Redis not running!" -ForegroundColor Red
    Write-Host "Starting Redis first..." -ForegroundColor Yellow
    Start-Process -FilePath "F:\watan\djangoo\redis\redis-server.exe" -WorkingDirectory "F:\watan\djangoo\redis" -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

# Start Celery Worker
Set-Location "F:\watan\djangoo"
$env:PYTHONPATH = "F:\watan\djangoo"

Write-Host "Starting Celery Worker..." -ForegroundColor Green
Write-Host ""

& "F:\watan\djangoo\venv\Scripts\python.exe" -m celery -A celery_app worker --pool=solo --loglevel=info

Write-Host ""
Write-Host "Celery Worker stopped." -ForegroundColor Red
Read-Host "Press Enter to close"
