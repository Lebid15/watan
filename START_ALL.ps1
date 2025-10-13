# Start All Services - Watan Project
# تشغيل جميع الخدمات - مشروع وطن

Write-Host ""
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "                      Starting All Services - Watan Project" -ForegroundColor Green
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "F:\watan"

# Function to start process in new window
function Start-ServiceInNewWindow {
    param(
        [string]$Title,
        [string]$Command,
        [string]$WorkingDirectory
    )
    
    Write-Host "Starting: $Title" -ForegroundColor Yellow
    
    $psCommand = "Set-Location '$WorkingDirectory'; Write-Host '=====================================================================================================' -ForegroundColor Cyan; Write-Host '$Title' -ForegroundColor Green; Write-Host '=====================================================================================================' -ForegroundColor Cyan; Write-Host ''; $Command; Read-Host 'Press Enter to close'"
    
    Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $psCommand
    Start-Sleep -Seconds 2
}

Write-Host "1/4 Starting Redis..." -ForegroundColor Green
Start-ServiceInNewWindow -Title "Redis Server (Port 6379)" -Command "powershell.exe -ExecutionPolicy Bypass -File '$projectRoot\djangoo\start_redis.ps1'" -WorkingDirectory "$projectRoot\djangoo"

Start-Sleep -Seconds 3

Write-Host "2/4 Starting Django Backend..." -ForegroundColor Green  
Start-ServiceInNewWindow -Title "Django Backend (Port 8000)" -Command ".\venv\Scripts\activate; python manage.py runserver" -WorkingDirectory "$projectRoot\djangoo"

Start-Sleep -Seconds 3

Write-Host "3/4 Starting Celery Worker..." -ForegroundColor Green
Start-ServiceInNewWindow -Title "Celery Worker - Order Status Monitoring" -Command "`$env:PYTHONPATH='$projectRoot\djangoo'; .\venv\Scripts\python.exe -m celery -A celery_app worker --pool=solo --loglevel=info" -WorkingDirectory "$projectRoot\djangoo"

Start-Sleep -Seconds 3

Write-Host "4/4 Starting Frontend..." -ForegroundColor Green
Start-ServiceInNewWindow -Title "Frontend (Port 3000)" -Command "npm run dev" -WorkingDirectory "$projectRoot\frontend"

Write-Host ""
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "                          All Services Started Successfully!" -ForegroundColor Green
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services running:" -ForegroundColor Yellow
Write-Host "  - Redis Server      : localhost:6379" -ForegroundColor Cyan
Write-Host "  - Django Backend    : http://localhost:8000" -ForegroundColor Cyan
Write-Host "  - Celery Worker     : Monitoring orders" -ForegroundColor Cyan
Write-Host "  - Frontend          : http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop all services, close all PowerShell windows" -ForegroundColor Yellow
Write-Host ""
Write-Host "Logs will appear in each window:" -ForegroundColor Yellow
Write-Host "  - Watch Celery Worker window to see order status checks" -ForegroundColor Cyan
Write-Host ""
Write-Host "Create a new order and watch the Celery window!" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit this window"
