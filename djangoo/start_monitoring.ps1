# Order Monitoring System - Startup Script for Windows

Write-Host "🚀 Starting Order Monitoring System..." -ForegroundColor Green
Write-Host ""

# Step 1: Check if Redis is running
Write-Host "📡 Step 1: Checking Redis..." -ForegroundColor Cyan
try {
    $redis = Test-Connection -ComputerName localhost -Port 6379 -Count 1 -ErrorAction Stop
    Write-Host "   ✅ Redis is running!" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Redis is not running!" -ForegroundColor Red
    Write-Host "   Please start Redis first:" -ForegroundColor Yellow
    Write-Host "   - redis-server" -ForegroundColor Yellow
    Write-Host "   - or: docker run -d -p 6379:6379 redis:alpine" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 2: Check if migration is applied
Write-Host "📋 Step 2: Checking database migration..." -ForegroundColor Cyan
Write-Host "   Run this SQL if not applied yet:" -ForegroundColor Yellow
Write-Host "   psql -U watan -d watan -f migration_provider_referans.sql" -ForegroundColor Yellow

Write-Host ""

# Step 3: Start Django
Write-Host "🌐 Step 3: Starting Django server..." -ForegroundColor Cyan
Write-Host "   Opening new terminal for Django..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; python manage.py runserver"
Start-Sleep -Seconds 2

Write-Host ""

# Step 4: Start Celery Worker
Write-Host "⚙️ Step 4: Starting Celery Worker..." -ForegroundColor Cyan
Write-Host "   Opening new terminal for Celery Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; celery -A djangoo worker --loglevel=info --pool=solo"
Start-Sleep -Seconds 2

Write-Host ""

# Step 5: Start Celery Beat
Write-Host "⏰ Step 5: Starting Celery Beat..." -ForegroundColor Cyan
Write-Host "   Opening new terminal for Celery Beat..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; celery -A djangoo beat --loglevel=info"

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Service URLs:" -ForegroundColor Cyan
Write-Host "   - Django: http://localhost:8000" -ForegroundColor White
Write-Host "   - Admin: http://localhost:8000/admin/" -ForegroundColor White
Write-Host ""
Write-Host "📝 Check the terminal windows for logs" -ForegroundColor Yellow
Write-Host ""
Write-Host "🛑 To stop: Close each terminal window" -ForegroundColor Red
