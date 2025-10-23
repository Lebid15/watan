# Staging Deployment Script for Baseline Logic Enforcement
# This script deploys the application with the required feature flags

param(
    [switch]$SkipTests,
    [switch]$SkipMigrations,
    [string]$Environment = "staging"
)

Write-Host "🚀 Deploying to staging environment with baseline logic enforcement..." -ForegroundColor Green

# Set staging environment variables
$env:FF_USD_COST_ENFORCEMENT = "1"
$env:FF_CHAIN_STATUS_PROPAGATION = "1"
$env:FF_AUTO_FALLBACK_ROUTING = "0"
$env:DJ_ZNET_SIMULATE = "false"
$env:DJ_DEBUG_LOGS = "1"
$env:DJANGO_SETTINGS_MODULE = "config.staging_settings"

Write-Host "✅ Environment variables set:" -ForegroundColor Yellow
Write-Host "   - FF_USD_COST_ENFORCEMENT=1"
Write-Host "   - FF_CHAIN_STATUS_PROPAGATION=1"
Write-Host "   - FF_AUTO_FALLBACK_ROUTING=0"
Write-Host "   - DJ_ZNET_SIMULATE=false"
Write-Host "   - DJ_DEBUG_LOGS=1"

# Activate virtual environment if present
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    Write-Host "🔧 Activating virtual environment..." -ForegroundColor Blue
    . .\.venv\Scripts\Activate.ps1
}

# Run tests unless skipped
if (-not $SkipTests) {
    Write-Host "🧪 Running baseline logic tests..." -ForegroundColor Blue
    python manage.py test apps.orders.tests.test_baseline_logic -v 2
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Tests failed! Deployment aborted." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ All tests passed!" -ForegroundColor Green
}

# Run migrations unless skipped
if (-not $SkipMigrations) {
    Write-Host "📦 Running database migrations..." -ForegroundColor Blue
    python manage.py migrate --settings=config.staging_settings
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Migrations failed! Deployment aborted." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Migrations completed!" -ForegroundColor Green
}

# Verify configuration
Write-Host "🔍 Verifying staging configuration..." -ForegroundColor Blue
python scripts/setup_staging.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Configuration verification failed!" -ForegroundColor Red
    exit 1
}

Write-Host "🎯 Staging deployment completed successfully!" -ForegroundColor Green
Write-Host "   Baseline logic enforcement is now active." -ForegroundColor Yellow
Write-Host "   Manual orders will use PriceGroup USD values directly." -ForegroundColor Yellow
Write-Host "   Dispatch will not set terminal statuses." -ForegroundColor Yellow
Write-Host "   No routing cases will be set to MANUAL mode." -ForegroundColor Yellow
Write-Host "   Provider costs will be converted from TRY to USD." -ForegroundColor Yellow







