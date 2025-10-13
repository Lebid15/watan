# Start Celery Worker for Order Status Monitoring
# تشغيل Celery Worker لمراقبة حالة الطلبات

Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting Celery Worker for Order Status Monitoring" -ForegroundColor Green
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""

# Set working directory
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host "📁 Working directory: $projectRoot" -ForegroundColor Yellow
Write-Host ""

# Check if Memurai/Redis is running
Write-Host "🔍 Checking Redis/Memurai service..." -ForegroundColor Yellow
$redisService = Get-Service | Where-Object {$_.Name -like "*redis*" -or $_.Name -like "*memurai*"}

if ($null -eq $redisService) {
    Write-Host "❌ Redis/Memurai is not installed!" -ForegroundColor Red
    Write-Host "   Please install Memurai from: https://www.memurai.com/get-memurai" -ForegroundColor Red
    Write-Host ""
    Write-Host "📚 See CELERY_SETUP_GUIDE.md for instructions" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

if ($redisService.Status -ne "Running") {
    Write-Host "⚠️  Redis/Memurai is not running. Trying to start..." -ForegroundColor Yellow
    try {
        Start-Service $redisService.Name
        Write-Host "✅ Started $($redisService.Name)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to start $($redisService.Name): $_" -ForegroundColor Red
        Write-Host "   Please start it manually from Services" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "✅ $($redisService.Name) is running" -ForegroundColor Green
}

Write-Host ""

# Set PYTHONPATH
$env:PYTHONPATH = $projectRoot
Write-Host "📌 PYTHONPATH set to: $projectRoot" -ForegroundColor Yellow
Write-Host ""

# Find Python executable
$pythonExe = Join-Path $projectRoot "venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    Write-Host "❌ Python virtual environment not found at: $pythonExe" -ForegroundColor Red
    Write-Host "   Please create a virtual environment first:" -ForegroundColor Yellow
    Write-Host "   python -m venv venv" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "🐍 Python: $pythonExe" -ForegroundColor Yellow
Write-Host ""

# Start Celery
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting Celery Worker + Beat..." -ForegroundColor Green
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 You will see logs like:" -ForegroundColor Yellow
Write-Host "   - 🔍 [محاولة #1] فحص حالة الطلب..." -ForegroundColor Cyan
Write-Host "   - 📡 استعلام عن حالة الطلب من المزود..." -ForegroundColor Cyan
Write-Host "   - 📥 استجابة المزود..." -ForegroundColor Cyan
Write-Host "   - ⚙️ تطبيق انتقال الحالة..." -ForegroundColor Cyan
Write-Host ""
Write-Host "⏰ Orders will be checked every 10 seconds until completed" -ForegroundColor Yellow
Write-Host "🔄 Batch check runs every 5 minutes for all pending orders" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

try {
    & $pythonExe -m celery -A celery_app worker --beat --pool=solo --loglevel=info
} catch {
    Write-Host ""
    Write-Host "❌ Error starting Celery: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
