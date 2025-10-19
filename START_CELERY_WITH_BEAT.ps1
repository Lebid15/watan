# ==============================================
#  Start Celery Worker + Beat Scheduler
#  This starts BOTH worker and beat!
# ==============================================

Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "                      CELERY WORKER + BEAT SCHEDULER" -ForegroundColor Green
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "WATCH THIS WINDOW! You will see:" -ForegroundColor Yellow
Write-Host "  - Order status checks every 5 minutes (periodic)" -ForegroundColor Cyan
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

# Start Celery Worker + Beat (as separate processes on Windows)
Set-Location "F:\watan\djangoo"
$env:PYTHONPATH = "F:\watan\djangoo"

Write-Host "Starting Celery Beat Scheduler in background..." -ForegroundColor Yellow
# Start Beat in a separate minimized window
$beatProcess = Start-Process -FilePath "F:\watan\djangoo\venv\Scripts\python.exe" `
    -ArgumentList "-m", "celery", "-A", "celery_app", "beat", "--loglevel=info" `
    -WorkingDirectory "F:\watan\djangoo" `
    -WindowStyle Minimized `
    -PassThru

Start-Sleep -Seconds 2
Write-Host "✅ Celery Beat started (PID: $($beatProcess.Id))" -ForegroundColor Green
Write-Host ""

Write-Host "Starting Celery Worker..." -ForegroundColor Green
Write-Host ""

# Start Worker in current window
& "F:\watan\djangoo\venv\Scripts\python.exe" -m celery -A celery_app worker --pool=solo --loglevel=info

Write-Host ""
Write-Host "Celery Worker stopped." -ForegroundColor Red
Write-Host "Stopping Celery Beat..." -ForegroundColor Yellow
Stop-Process -Id $beatProcess.Id -Force -ErrorAction SilentlyContinue
Read-Host "Press Enter to close"
