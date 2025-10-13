# Start All Services

Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "                      Starting Watan Services" -ForegroundColor Green
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Redis
Write-Host "1/4 Starting Redis..." -ForegroundColor Yellow
$redisPath = "F:\watan\djangoo\redis\redis-server.exe"

if (Test-Path $redisPath) {
    Start-Process -FilePath $redisPath -WorkingDirectory "F:\watan\djangoo\redis" -WindowStyle Normal
    Write-Host "   OK Redis started" -ForegroundColor Green
    Start-Sleep -Seconds 3
} else {
    Write-Host "   ERROR Redis not found. Run start_redis.ps1 first" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# 2. Celery Worker
Write-Host "2/4 Starting Celery Worker..." -ForegroundColor Yellow
$celeryCmd = "Set-Location 'F:\watan\djangoo'; `$env:PYTHONPATH='F:\watan\djangoo'; Write-Host 'Celery Worker - Order Status Monitoring'; Write-Host 'WATCH THIS WINDOW!'; Write-Host ''; & 'F:\watan\djangoo\venv\Scripts\python.exe' -m celery -A celery_app worker --pool=solo --loglevel=info"

Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $celeryCmd
Write-Host "   OK Celery Worker started" -ForegroundColor Green
Start-Sleep -Seconds 5

# 3. Django
Write-Host "3/4 Starting Django Backend..." -ForegroundColor Yellow
$djangoCmd = "Set-Location 'F:\watan\djangoo'; & '.\venv\Scripts\activate.ps1'; python manage.py runserver"
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $djangoCmd
Write-Host "   OK Django started" -ForegroundColor Green
Start-Sleep -Seconds 3

# 4. Frontend
Write-Host "4/4 Starting Frontend..." -ForegroundColor Yellow
$frontendCmd = "Set-Location 'F:\watan\frontend'; npm run dev"
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $frontendCmd
Write-Host "   OK Frontend started" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "                          ALL SERVICES RUNNING!" -ForegroundColor Green
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services:" -ForegroundColor Yellow
Write-Host "  - Redis Server      : localhost:6379" -ForegroundColor Cyan
Write-Host "  - Celery Worker     : Running (WATCH THIS WINDOW)" -ForegroundColor Cyan
Write-Host "  - Django Backend    : http://localhost:8000" -ForegroundColor Cyan
Write-Host "  - Frontend          : http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "WATCH THE CELERY WINDOW TO SEE ORDER STATUS CHECKS!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost:3000" -ForegroundColor Cyan
Write-Host "  2. Create a new order" -ForegroundColor Cyan
Write-Host "  3. Watch Celery window - checks every 10 seconds" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close (services will keep running)"
