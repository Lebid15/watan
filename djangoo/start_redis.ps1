# Redis Installer for Windows - Quick Setup
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "Redis Quick Installer for Windows" -ForegroundColor Green
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""

$redisDir = "F:\watan\djangoo\redis"
$redisZip = "$redisDir\redis.zip"
$redisExe = "$redisDir\redis-server.exe"

# Create redis directory
if (-not (Test-Path $redisDir)) {
    Write-Host "Creating Redis directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $redisDir -Force | Out-Null
}

# Check if Redis is already downloaded
if (Test-Path $redisExe) {
    Write-Host "Redis is already installed" -ForegroundColor Green
} else {
    Write-Host "Downloading Redis from GitHub..." -ForegroundColor Yellow
    Write-Host "This may take a minute..." -ForegroundColor Yellow
    
    $redisUrl = "https://github.com/microsoftarchive/redis/releases/download/win-3.2.100/Redis-x64-3.2.100.zip"
    
    try {
        Invoke-WebRequest -Uri $redisUrl -OutFile $redisZip -UseBasicParsing
        Write-Host "Download complete" -ForegroundColor Green
        
        Write-Host "Extracting Redis..." -ForegroundColor Yellow
        Expand-Archive -Path $redisZip -DestinationPath $redisDir -Force
        Remove-Item $redisZip
        Write-Host "Extraction complete" -ForegroundColor Green
    } catch {
        Write-Host "Failed to download Redis" -ForegroundColor Red
        Write-Host "Please download manually from:" -ForegroundColor Yellow
        Write-Host "https://github.com/microsoftarchive/redis/releases/download/win-3.2.100/Redis-x64-3.2.100.zip" -ForegroundColor Cyan
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host "Starting Redis Server on port 6379..." -ForegroundColor Green
Write-Host "Keep this window open!" -ForegroundColor Red
Write-Host "=====================================================================================================" -ForegroundColor Cyan
Write-Host ""

# Start Redis
Set-Location $redisDir
& .\redis-server.exe
