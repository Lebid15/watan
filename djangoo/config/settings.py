import os
from pathlib import Path
from datetime import timedelta

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env if present. Force override to avoid leaked shell env overriding local file during dev.
load_dotenv(BASE_DIR / ".env", override=True)

# ======== CRITICAL SECURITY SETTINGS ========
# SECRET_KEY - يجب أن يكون موجود في الإنتاج
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-secret")
if SECRET_KEY == "dev-insecure-secret" and os.getenv("ENVIRONMENT") == "production":
    raise ValueError("⚠️ DJANGO_SECRET_KEY must be set with a secure value in production!")

# DEBUG - يجب أن يكون False في الإنتاج
DEBUG = os.getenv("DJANGO_DEBUG", "0") == "1"
if DEBUG and os.getenv("ENVIRONMENT") == "production":
    raise ValueError("⚠️ DEBUG mode is not allowed in production! Set DJANGO_DEBUG=0")

# ALLOWED_HOSTS - يجب تحديدها في الإنتاج
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")
if "*" in ALLOWED_HOSTS and os.getenv("ENVIRONMENT") == "production":
    raise ValueError("⚠️ ALLOWED_HOSTS must be specified in production! Do not use '*'")

LANGUAGE_CODE = os.getenv("DJANGO_LANGUAGE_CODE", "ar")
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

API_PREFIX = "/api-dj"


def _env_flag(name: str, default: str = "0") -> bool:
    """Normalize boolean-ish environment flags (1/true/on/y/yes)."""
    value = os.getenv(name, default)
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on", "y"}


# Feature flags (Phase 0 scaffolding) – default to False/disabled
FF_CHAIN_STATUS_PROPAGATION = _env_flag("FF_CHAIN_STATUS_PROPAGATION", "1")  # ✅ Enabled for chain wallet updates
FF_USD_COST_ENFORCEMENT = _env_flag("FF_USD_COST_ENFORCEMENT", "0")
FF_AUTO_FALLBACK_ROUTING = _env_flag("FF_AUTO_FALLBACK_ROUTING", "0")
FF_ADMIN_REROUTE_UI = _env_flag("FF_ADMIN_REROUTE_UI", "0")

INSTALLED_APPS = [
    "jazzmin",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "drf_spectacular",
    "django_celery_results",
    "django_celery_beat",
    "apps.core",
    "apps.tenancy",
    "apps.users",
    "apps.products",
    "apps.currencies",
    "apps.orders",
    "apps.payments",
    "apps.payouts",
    "apps.providers",
    "apps.reports",
    "apps.notifications",
    "apps.tenants",
    "apps.external_api",
    "apps.codes",
    "apps.pages",
    "apps.devtools",
    "apps.dashboard",
    "apps.banners",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.tenancy.middleware.TenantHostMiddleware",
    "apps.core.middleware.RequestLogMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "watan"),
        "USER": os.getenv("POSTGRES_USER", "watan"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "changeme"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
        # Ensure a valid default schema is used even if DB-level search_path is unset
        "OPTIONS": {
            "options": "-c search_path=public,pg_catalog",
        },
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0"),
    }
}

AUTH_USER_MODEL = "users.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.users.auth.LegacyJWTAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "apps.users.auth.ApiTokenAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MIN", "60"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "SIGNING_KEY": os.getenv("JWT_SECRET", SECRET_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Watan DJ API",
    "DESCRIPTION": "Django parity API under /api-dj",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# CORS: allow specific dev origins and credentials
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://alsham.localhost:3000",
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://[a-z0-9.-]*localhost:3000$",
]
# Allow custom headers used by the app
from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-tenant-host",
    "x-tenant-id",
    "x-api-token",
    "api-token",
]

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "static"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media (for admin uploads like product images)
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Tenant header name
TENANT_HEADER = "HTTP_X_TENANT_HOST"
PUBLIC_TENANT_BASE_DOMAIN = os.getenv("PUBLIC_TENANT_BASE_DOMAIN", "wtn4.com")

# CSRF trusted origins for dev
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://alsham.localhost:3000",
]

# Jazzmin (basic)
JAZZMIN_SETTINGS = {
    "site_title": "Watan Admin",
    "site_header": "Watan Admin",
    "site_brand": "Watan",
}

# Consistent look & RTL polish for Jazzmin
JAZZMIN_UI_TWEAKS = {
    # Colors and navbar/sidebar consistency
    "navbar": "navbar-dark",
    "navbar_fixed": True,
    "layout_boxed": False,
    "sidebar_fixed": True,
    "theme": "darkly",
    # Buttons/colors harmonization
    "button_classes": {
        "primary": "btn btn-primary",
        "secondary": "btn btn-secondary",
        "info": "btn btn-info",
        "warning": "btn btn-warning",
        "danger": "btn btn-danger",
        "success": "btn btn-success",
    },
}

JAZZMIN_SETTINGS["custom_css"] = "admin_rtl.css"

# Email defaults (console backend in dev unless overridden)
EMAIL_BACKEND = os.getenv("DJANGO_EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DJANGO_DEFAULT_FROM_EMAIL", "noreply@watan.local")

# Frontend base URL for building links in transactional emails
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")

# Password reset token TTL in minutes
PASSWORD_RESET_TOKEN_TTL = int(os.getenv("DJANGO_PASSWORD_RESET_TOKEN_TTL", "60"))

# ============================================================================
# CELERY CONFIGURATION
# ============================================================================
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'default'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Damascus'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes
CELERY_TASK_ALWAYS_EAGER = False  # ✅ Changed to False - use real Celery Worker for background tasks
CELERY_TASK_EAGER_PROPAGATES = True

# Celery Beat (Periodic Tasks)
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

PASSWORD_RESET_TOKEN_TTL_MINUTES = int(os.getenv("PASSWORD_RESET_TOKEN_TTL_MINUTES", "60"))

# ============================================================================
# CRITICAL SECURITY SETTINGS FOR PRODUCTION
# ============================================================================

# Security Middleware Settings - تفعيل في الإنتاج فقط
if not DEBUG and os.getenv("ENVIRONMENT") == "production":
    # Force HTTPS
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    
    # HSTS (HTTP Strict Transport Security)
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Security Headers - دائماً مفعلة
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'SAMEORIGIN'

# Cookie Security
CSRF_COOKIE_SECURE = not DEBUG  # HTTPS only في الإنتاج
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'

SESSION_COOKIE_SECURE = not DEBUG  # HTTPS only في الإنتاج
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_AGE = 86400  # 24 hours

# Password Validation - تقوية متطلبات كلمة المرور
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,  # الحد الأدنى 8 أحرف
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Security Logging - تسجيل الأحداث الأمنية
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'security_file': {
            'level': 'WARNING',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'security.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 5,
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
