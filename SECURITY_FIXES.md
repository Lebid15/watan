# دليل تطبيق الإصلاحات الأمنية

## 🚀 الإصلاحات السريعة (Quick Fixes)

### 1. توليد كلمات مرور قوية

```bash
# توليد SECRET_KEY لـ Django
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# توليد JWT_SECRET
openssl rand -base64 64

# توليد كلمة مرور PostgreSQL
openssl rand -base64 32
```

### 2. تحديث ملف .env للإنتاج

قم بإنشاء ملف `.env.production` بالإعدادات الآمنة:

```env
# Django
DJANGO_SECRET_KEY=<استخدم الناتج من الأمر أعلاه>
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=wtn4.com,*.wtn4.com,api.wtn4.com,watan.games,*.watan.games

# Database
POSTGRES_DB=watan
POSTGRES_USER=watan_prod
POSTGRES_PASSWORD=<كلمة مرور قوية جداً>
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# JWT
JWT_SECRET=<استخدم الناتج من openssl rand>
JWT_ACCESS_MIN=60
JWT_REFRESH_DAYS=7

# Redis
REDIS_URL=redis://redis:6379/0

# Frontend
FRONTEND_BASE_URL=https://wtn4.com
NEXT_PUBLIC_API_URL=https://api.wtn4.com/api

# Email (حسب مزود الخدمة)
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=1
EMAIL_HOST_USER=noreply@wtn4.com
EMAIL_HOST_PASSWORD=<كلمة مرور التطبيق>

# Security
SECURE_SSL_REDIRECT=1
SESSION_COOKIE_SECURE=1
CSRF_COOKIE_SECURE=1
```

### 3. تحديث docker-compose.yml للإنتاج

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: watan-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # من .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - watan-network
    # لا تعرض المنفذ للخارج في الإنتاج
    # ports:
    #   - "5432:5432"
    expose:
      - "5432"

volumes:
  postgres_data:
    driver: local

networks:
  watan-network:
    driver: bridge
```

---

## 🔧 تحديثات على الكود

### 1. تحديث Django Settings (`djangoo/config/settings.py`)

```python
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env
load_dotenv(BASE_DIR / ".env", override=True)

# ======== SECURITY SETTINGS ========

# SECRET_KEY - يجب أن يكون موجود دائماً
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("ENVIRONMENT") == "production":
        raise ValueError("DJANGO_SECRET_KEY must be set in production!")
    SECRET_KEY = "dev-insecure-secret-only-for-development"

# DEBUG - يجب أن يكون False في الإنتاج
DEBUG = os.getenv("DJANGO_DEBUG", "0") == "1"

# تحذير إذا كان DEBUG مفعل في الإنتاج
if DEBUG and os.getenv("ENVIRONMENT") == "production":
    raise ValueError("DEBUG mode is not allowed in production!")

# ALLOWED_HOSTS - يجب تحديدها في الإنتاج
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",")
if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['']:
    if DEBUG:
        ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]']
    else:
        raise ValueError("DJANGO_ALLOWED_HOSTS must be set in production!")

# CORS Settings - صارمة في الإنتاج
CORS_ALLOW_ALL_ORIGINS = DEBUG  # فقط في التطوير
CORS_ALLOW_CREDENTIALS = True

if not DEBUG:
    # في الإنتاج - حدد النطاقات بدقة
    CORS_ALLOWED_ORIGINS = [
        "https://wtn4.com",
        "https://www.wtn4.com",
        "https://api.wtn4.com",
        "https://watan.games",
        "https://www.watan.games",
    ]
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^https://[a-z0-9-]+\.wtn4\.com$",
        r"^https://[a-z0-9-]+\.watan\.games$",
    ]
else:
    # في التطوير
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

# CSRF Settings
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS.copy()
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'

# Session Security
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_AGE = 86400  # 24 hours

# Security Middleware Settings
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'SAMEORIGIN'

# Password Validation - قوية
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 12,  # زيادة الحد الأدنى
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Database with SSL in production
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "watan"),
        "USER": os.getenv("POSTGRES_USER", "watan"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
        "OPTIONS": {
            "options": "-c search_path=public,pg_catalog",
        },
    }
}

# Enable SSL for production
if not DEBUG:
    DATABASES["default"]["OPTIONS"]["sslmode"] = "require"

# Security Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'security_file': {
            'level': 'WARNING',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'security.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django.security': {
            'handlers': ['security_file', 'console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['security_file', 'console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# إنشاء مجلد logs إذا لم يكن موجود
(BASE_DIR / 'logs').mkdir(exist_ok=True)
```

### 2. تحديث Nginx Security Headers (`nginx/nginx.conf`)

أضف هذا في بداية ملف التكوين:

```nginx
# Security Headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.wtn4.com;" always;

# Hide Nginx version
server_tokens off;

# Rate Limiting Zones
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=200r/m;

# Connection Limiting
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
```

وأضف Rate Limiting للمسارات الحساسة:

```nginx
# Login endpoints
location ~ ^/(api|api-dj)/auth/login {
    limit_req zone=login_limit burst=5 nodelay;
    limit_conn conn_limit 10;
    # ... باقي الإعدادات
}

# API endpoints
location ~ ^/(api|api-dj)/ {
    limit_req zone=api_limit burst=50 nodelay;
    limit_conn conn_limit 20;
    # ... باقي الإعدادات
}

# General requests
location / {
    limit_req zone=general_limit burst=100 nodelay;
    limit_conn conn_limit 50;
    # ... باقي الإعدادات
}
```

### 3. إزالة csrf_exempt من Views الحساسة

في `djangoo/apps/core/views.py`:

```python
# بدلاً من:
# @csrf_exempt
# def dev_maintenance_get(request: HttpRequest):

# استخدم:
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser

@api_view(['GET'])
@permission_classes([IsAdminUser])  # أو AllowAny إذا كان عام
def dev_maintenance_get(request):
    # ... الكود الحالي
```

---

## 🛡️ إضافة Rate Limiting في Django

### تثبيت المكتبة

```bash
pip install django-ratelimit
```

### إضافة في `requirements.txt`

```
django-ratelimit==4.1.0
```

### الاستخدام

```python
from django_ratelimit.decorators import ratelimit

# في views.py
@ratelimit(key='ip', rate='5/m', method='POST')
def login_view(request):
    # ...

@ratelimit(key='user_or_ip', rate='100/h')
def api_endpoint(request):
    # ...
```

---

## 📊 فحص الثغرات في المكتبات

### Python (Django)

```bash
cd djangoo

# فحص الثغرات
pip install safety
safety check

# تحديث المكتبات
pip list --outdated
pip install --upgrade <package-name>

# أو استخدم pip-audit
pip install pip-audit
pip-audit
```

### Node.js (Backend & Frontend)

```bash
# Backend
cd backend
npm audit
npm audit fix

# Frontend
cd frontend
npm audit
npm audit fix

# للمشاكل الخطيرة
npm audit fix --force
```

---

## 🔐 تفعيل SSL/TLS

### باستخدام Let's Encrypt (Certbot)

```bash
# تثبيت Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# توليد الشهادة
sudo certbot --nginx -d wtn4.com -d www.wtn4.com -d api.wtn4.com

# تجديد تلقائي
sudo certbot renew --dry-run
```

### تحديث docker-compose.yml للـ SSL

```yaml
services:
  nginx:
    volumes:
      - ./certs:/etc/nginx/certs:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
```

---

## ✅ Checklist النهائي

### قبل الإطلاق في الإنتاج:

- [ ] تغيير جميع كلمات المرور الافتراضية
- [ ] توليد SECRET_KEY و JWT_SECRET جديد
- [ ] تحديد ALLOWED_HOSTS و CORS_ALLOWED_ORIGINS
- [ ] DEBUG=0 في الإنتاج
- [ ] تفعيل HTTPS فقط
- [ ] إضافة Security Headers
- [ ] تفعيل Rate Limiting
- [ ] فحص المكتبات (npm audit / safety check)
- [ ] تفعيل SSL لقاعدة البيانات
- [ ] إعداد Logging للأحداث الأمنية
- [ ] إعداد نسخ احتياطية منتظمة
- [ ] اختبار جميع endpoints
- [ ] مراجعة أذونات المستخدمين
- [ ] إزالة أي بيانات تجريبية
- [ ] تأكيد عدم وجود أسرار في Git

---

## 🚨 في حالة الطوارئ (Security Breach)

1. **قم بإيقاف الخدمة فوراً**
   ```bash
   docker-compose down
   ```

2. **قم بتغيير جميع كلمات المرور والأسرار**

3. **راجع Logs للكشف عن النشاط المشبوه**
   ```bash
   # Django logs
   tail -f djangoo/logs/security.log
   
   # Nginx logs
   docker logs watan-nginx
   
   # Database logs
   docker logs watan-postgres
   ```

4. **قم بفحص شامل للكود والبيانات**

5. **أبلغ المستخدمين إذا تأثرت بياناتهم**

6. **وثق الحادثة وتعلم منها**

---

**آخر تحديث:** 16 أكتوبر 2025
