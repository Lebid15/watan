# Security Fix Automation Script
# تطبيق الإصلاحات الأمنية تلقائياً

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Watan Security Fixes Automation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# تحقق من وجود Python و Node.js
function Test-Prerequisites {
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow
    
    $python = Get-Command python -ErrorAction SilentlyContinue
    $node = Get-Command node -ErrorAction SilentlyContinue
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    
    if (-not $python) {
        Write-Host "❌ Python not found!" -ForegroundColor Red
        return $false
    }
    
    if (-not $node) {
        Write-Host "❌ Node.js not found!" -ForegroundColor Red
        return $false
    }
    
    if (-not $docker) {
        Write-Host "⚠️  Docker not found - skipping Docker checks" -ForegroundColor Yellow
    }
    
    Write-Host "✅ All prerequisites met" -ForegroundColor Green
    return $true
}

# توليد أسرار قوية
function Generate-Secrets {
    Write-Host ""
    Write-Host "🔐 Generating secure secrets..." -ForegroundColor Yellow
    
    # Django SECRET_KEY
    Write-Host "Generating Django SECRET_KEY..." -ForegroundColor Gray
    $djangoSecret = python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
    
    # JWT Secret (64 bytes base64)
    Write-Host "Generating JWT_SECRET..." -ForegroundColor Gray
    $jwtBytes = New-Object byte[] 64
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($jwtBytes)
    $jwtSecret = [Convert]::ToBase64String($jwtBytes)
    
    # PostgreSQL Password (32 bytes base64)
    Write-Host "Generating POSTGRES_PASSWORD..." -ForegroundColor Gray
    $pgBytes = New-Object byte[] 32
    $rng.GetBytes($pgBytes)
    $pgPassword = [Convert]::ToBase64String($pgBytes)
    
    Write-Host "✅ Secrets generated successfully" -ForegroundColor Green
    
    return @{
        DjangoSecret = $djangoSecret
        JwtSecret = $jwtSecret
        PostgresPassword = $pgPassword
    }
}

# إنشاء ملف .env.production
function Create-ProductionEnv {
    param (
        [hashtable]$Secrets
    )
    
    Write-Host ""
    Write-Host "📝 Creating .env.production file..." -ForegroundColor Yellow
    
    $envContent = @"
# ========================================
# Production Environment Variables
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# ========================================

# ======== Django Settings ========
DJANGO_SECRET_KEY=$($Secrets.DjangoSecret)
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=wtn4.com,*.wtn4.com,api.wtn4.com,watan.games,*.watan.games
DJANGO_LANGUAGE_CODE=ar
DJANGO_TIME_ZONE=UTC

# ======== Database ========
POSTGRES_DB=watan
POSTGRES_USER=watan_prod
POSTGRES_PASSWORD=$($Secrets.PostgresPassword)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# ======== JWT ========
JWT_SECRET=$($Secrets.JwtSecret)
JWT_ACCESS_MIN=60
JWT_REFRESH_DAYS=7

# ======== Redis ========
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0

# ======== Frontend ========
FRONTEND_BASE_URL=https://wtn4.com
NEXT_PUBLIC_API_URL=https://api.wtn4.com/api
NEXT_PUBLIC_FEATURE_BILLING_V1=true

# ======== Email (Configure based on your provider) ========
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USE_TLS=1
# EMAIL_HOST_USER=noreply@wtn4.com
# EMAIL_HOST_PASSWORD=your_app_password_here

# ======== Security ========
ENVIRONMENT=production
SECURE_SSL_REDIRECT=1
SESSION_COOKIE_SECURE=1
CSRF_COOKIE_SECURE=1

# ======== Cloudinary (Optional) ========
# CLOUDINARY_CLOUD_NAME=your_cloud_name
# CLOUDINARY_API_KEY=your_api_key
# CLOUDINARY_API_SECRET=your_api_secret

# ======== Public Settings ========
PUBLIC_TENANT_BASE_DOMAIN=wtn4.com
FEATURE_BILLING_V1=true

# ========================================
# ⚠️  IMPORTANT SECURITY NOTES:
# 1. NEVER commit this file to Git
# 2. Keep this file secure and backed up
# 3. Use different secrets for each environment
# 4. Rotate secrets regularly (every 3-6 months)
# ========================================
"@
    
    $envPath = ".\.env.production"
    $envContent | Out-File -FilePath $envPath -Encoding UTF8
    
    Write-Host "✅ Created $envPath" -ForegroundColor Green
    Write-Host "⚠️  Remember to add .env.production to .gitignore" -ForegroundColor Yellow
}

# تحديث .gitignore
function Update-GitIgnore {
    Write-Host ""
    Write-Host "📝 Updating .gitignore..." -ForegroundColor Yellow
    
    $gitignorePath = ".\.gitignore"
    
    if (-not (Test-Path $gitignorePath)) {
        Write-Host "Creating new .gitignore file..." -ForegroundColor Gray
        New-Item -Path $gitignorePath -ItemType File | Out-Null
    }
    
    $gitignoreContent = Get-Content $gitignorePath -Raw -ErrorAction SilentlyContinue
    
    $entriesToAdd = @(
        "# Environment files",
        ".env",
        ".env.local",
        ".env.production",
        ".env.*.local",
        "",
        "# Security",
        "*.log",
        "logs/",
        "*.key",
        "*.pem",
        "*.crt",
        "",
        "# Database",
        "*.sql",
        "dump.rdb",
        "",
        "# Sensitive data",
        "secrets/",
        "credentials/"
    )
    
    $needsUpdate = $false
    foreach ($entry in $entriesToAdd) {
        if ($gitignoreContent -notmatch [regex]::Escape($entry)) {
            $needsUpdate = $true
            break
        }
    }
    
    if ($needsUpdate) {
        Add-Content -Path $gitignorePath -Value "`n# Added by security script"
        foreach ($entry in $entriesToAdd) {
            if ($gitignoreContent -notmatch [regex]::Escape($entry)) {
                Add-Content -Path $gitignorePath -Value $entry
            }
        }
        Write-Host "✅ Updated .gitignore" -ForegroundColor Green
    } else {
        Write-Host "✅ .gitignore already up to date" -ForegroundColor Green
    }
}

# فحص المكتبات
function Check-Dependencies {
    Write-Host ""
    Write-Host "🔍 Checking for vulnerable dependencies..." -ForegroundColor Yellow
    
    # Python dependencies
    Write-Host ""
    Write-Host "Checking Python packages..." -ForegroundColor Gray
    Push-Location djangoo
    
    if (Test-Path "requirements.txt") {
        Write-Host "Installing safety checker..." -ForegroundColor Gray
        pip install safety -q 2>$null
        
        Write-Host "Running safety check..." -ForegroundColor Gray
        safety check --json | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ No known vulnerabilities in Python packages" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Found vulnerabilities in Python packages - run 'safety check' for details" -ForegroundColor Yellow
        }
    }
    
    Pop-Location
    
    # Node.js dependencies - Backend
    Write-Host ""
    Write-Host "Checking Backend Node.js packages..." -ForegroundColor Gray
    Push-Location backend
    
    if (Test-Path "package.json") {
        npm audit --json | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ No known vulnerabilities in Backend packages" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Found vulnerabilities in Backend packages - run 'npm audit' for details" -ForegroundColor Yellow
        }
    }
    
    Pop-Location
    
    # Node.js dependencies - Frontend
    Write-Host ""
    Write-Host "Checking Frontend Node.js packages..." -ForegroundColor Gray
    Push-Location frontend
    
    if (Test-Path "package.json") {
        npm audit --json | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ No known vulnerabilities in Frontend packages" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Found vulnerabilities in Frontend packages - run 'npm audit' for details" -ForegroundColor Yellow
        }
    }
    
    Pop-Location
}

# إنشاء مجلد logs
function Create-LogsDirectory {
    Write-Host ""
    Write-Host "📁 Creating logs directory..." -ForegroundColor Yellow
    
    $logsDirs = @(
        ".\djangoo\logs",
        ".\backend\logs",
        ".\frontend\logs"
    )
    
    foreach ($dir in $logsDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -Path $dir -ItemType Directory | Out-Null
            Write-Host "✅ Created $dir" -ForegroundColor Green
        } else {
            Write-Host "✅ $dir already exists" -ForegroundColor Green
        }
    }
}

# التحقق من ملفات حساسة في Git
function Check-GitSecrets {
    Write-Host ""
    Write-Host "🔍 Checking for secrets in Git history..." -ForegroundColor Yellow
    
    $sensitivePatterns = @(
        "password\s*=\s*['\"][^'\"]+['\"]",
        "SECRET_KEY\s*=\s*['\"][^'\"]+['\"]",
        "API_KEY\s*=\s*['\"][^'\"]+['\"]",
        "token\s*=\s*['\"][^'\"]+['\"]"
    )
    
    $foundSecrets = $false
    
    foreach ($pattern in $sensitivePatterns) {
        $result = git log --all --full-history -p -S $pattern 2>$null
        if ($result) {
            $foundSecrets = $true
            Write-Host "⚠️  Found potential secrets matching: $pattern" -ForegroundColor Yellow
        }
    }
    
    if (-not $foundSecrets) {
        Write-Host "✅ No obvious secrets found in Git history" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Consider using git-filter-repo to remove secrets from history" -ForegroundColor Yellow
    }
}

# الدالة الرئيسية
function Main {
    Write-Host ""
    Write-Host "Starting security fixes automation..." -ForegroundColor Cyan
    Write-Host ""
    
    # التحقق من المتطلبات
    if (-not (Test-Prerequisites)) {
        Write-Host ""
        Write-Host "❌ Prerequisites check failed. Please install missing tools." -ForegroundColor Red
        return
    }
    
    # توليد الأسرار
    $secrets = Generate-Secrets
    
    # إنشاء ملف .env للإنتاج
    Create-ProductionEnv -Secrets $secrets
    
    # تحديث .gitignore
    Update-GitIgnore
    
    # إنشاء مجلدات logs
    Create-LogsDirectory
    
    # فحص المكتبات
    Check-Dependencies
    
    # التحقق من الأسرار في Git
    Check-GitSecrets
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   ✅ Security fixes applied!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Review and update .env.production with your specific settings" -ForegroundColor White
    Write-Host "2. Update docker-compose.yml to use .env.production" -ForegroundColor White
    Write-Host "3. Review SECURITY_AUDIT_REPORT.md for detailed recommendations" -ForegroundColor White
    Write-Host "4. Review SECURITY_FIXES.md for manual fixes" -ForegroundColor White
    Write-Host "5. Test all changes in a staging environment first" -ForegroundColor White
    Write-Host "6. Run 'npm audit fix' in backend and frontend directories" -ForegroundColor White
    Write-Host "7. Run 'safety check' in djangoo directory" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  Important:" -ForegroundColor Red
    Write-Host "   - NEVER commit .env.production to Git" -ForegroundColor Red
    Write-Host "   - Change default passwords in docker-compose.yml" -ForegroundColor Red
    Write-Host "   - Enable HTTPS before going to production" -ForegroundColor Red
    Write-Host ""
    
    # عرض ملخص الأسرار المولدة
    Write-Host "🔐 Generated Secrets Summary:" -ForegroundColor Cyan
    Write-Host "   These secrets have been saved to .env.production" -ForegroundColor Gray
    Write-Host "   Keep them safe and never share them!" -ForegroundColor Gray
    Write-Host ""
}

# تنفيذ السكريبت
try {
    Main
} catch {
    Write-Host ""
    Write-Host "❌ An error occurred: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
}
