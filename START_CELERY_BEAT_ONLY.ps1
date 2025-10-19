# ==============================================
#  Start Celery Beat Scheduler ONLY
#  This runs periodic tasks scheduler
# ==============================================

Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "                      CELERY BEAT SCHEDULER" -ForegroundColor Green
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This scheduler sends periodic tasks to the queue:" -ForegroundColor Yellow
Write-Host "  - check_pending_orders_batch every 5 minutes" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: You MUST also run START_CELERY_ONLY.ps1 for Worker!" -ForegroundColor Red
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

# Start Celery Beat
Set-Location "F:\watan\djangoo"
$env:PYTHONPATH = "F:\watan\djangoo"

Write-Host "Starting Celery Beat Scheduler..." -ForegroundColor Green
Write-Host ""

& "F:\watan\djangoo\venv\Scripts\python.exe" -m celery -A celery_app beat --loglevel=info

Write-Host ""
Write-Host "Celery Beat stopped." -ForegroundColor Red
Read-Host "Press Enter to close"
