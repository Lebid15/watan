# تقرير الفحص الأمني - مشروع Watan
**تاريخ الفحص:** 16 أكتوبر 2025
**المدقق:** GitHub Copilot

---

## 📊 ملخص تنفيذي

تم إجراء فحص أمني شامل للمشروع الذي يتكون من:
- **Backend:** NestJS/Node.js + TypeScript
- **Django:** Python (djangoo)
- **Frontend:** Next.js + React
- **قاعدة البيانات:** PostgreSQL
- **Cache:** Redis
- **Web Server:** Nginx

---

## 🔴 ثغرات حرجة (Critical)

### 1. **كلمات مرور افتراضية ضعيفة في الإنتاج**
**الخطورة:** 🔴 حرجة جداً  
**الموقع:** `docker-compose.yml`

```yaml
POSTGRES_PASSWORD: changeme  # خطر! كلمة مرور ضعيفة
DATABASE_URL: "postgres://watan:changeme@postgres:5432/watan"
```

**التأثير:**
- إمكانية الوصول الكامل لقاعدة البيانات
- سرقة جميع بيانات المستخدمين والمعاملات المالية
- تعديل أو حذف البيانات

**الحل:**
```yaml
# استخدم كلمات مرور قوية ومعقدة
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # من ملف .env
# مثال: Wtn@2025!SecureDB#PostgreSQL$9876
```

---

### 2. **DEBUG MODE محتمل في الإنتاج**
**الخطورة:** 🔴 حرجة  
**الموقع:** `djangoo/config/settings.py`

```python
DEBUG = os.getenv("DJANGO_DEBUG", "0") == "1"
```

**المشكلة:**
- إذا تم تفعيل DEBUG في الإنتاج، سيتم كشف معلومات حساسة:
  - Stack traces كاملة
  - متغيرات البيئة
  - استعلامات SQL
  - مسارات الملفات

**الحل:**
```python
# تأكد دائماً من أن DEBUG=0 في الإنتاج
# أضف تحذير إذا كان DEBUG=1 في production
if DEBUG and os.getenv('ENVIRONMENT') == 'production':
    raise ValueError("DEBUG mode is not allowed in production!")
```

---

### 3. **SECRET_KEY افتراضي غير آمن**
**الخطورة:** 🔴 حرجة  
**الموقع:** `djangoo/config/settings.py`

```python
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-secret")
```

**التأثير:**
- إمكانية تزوير الجلسات (Session Hijacking)
- فك تشفير CSRF tokens
- تزوير JWT tokens

**الحل:**
```python
# لا تستخدم قيمة افتراضية في الإنتاج
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("DJANGO_SECRET_KEY must be set in production!")

# توليد secret key قوي:
# python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

---

### 4. **ALLOWED_HOSTS = "*" في الإنتاج**
**الخطورة:** 🟠 عالية  
**الموقع:** `djangoo/config/settings.py`

```python
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")
```

**التأثير:**
- هجمات Host Header Injection
- Cache Poisoning
- SSRF attacks

**الحل:**
```python
# حدد النطاقات المسموحة فقط
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",")
if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['']:
    if not DEBUG:
        raise ValueError("DJANGO_ALLOWED_HOSTS must be set in production!")
    ALLOWED_HOSTS = ['localhost', '127.0.0.1']

# في ملف .env للإنتاج:
# DJANGO_ALLOWED_HOSTS=wtn4.com,*.wtn4.com,api.wtn4.com
```

---

### 5. **استخدام csrf_exempt بدون حماية كافية**
**الخطورة:** 🟠 عالية  
**الموقع:** `djangoo/apps/core/views.py`

```python
@csrf_exempt
def dev_maintenance_get(request: HttpRequest):
    # ...
```

**التأثير:**
- هجمات CSRF على endpoints حساسة
- إمكانية تنفيذ عمليات غير مصرح بها

**الحل:**
```python
# استخدم CSRF protection أو API authentication بدلاً من csrf_exempt
# إذا كان endpoint للـ API فقط، استخدم:
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dev_maintenance_get(request):
    # ...
```

---

## 🟡 ثغرات متوسطة (Medium)

### 6. **عدم وجود Rate Limiting**
**الخطورة:** 🟡 متوسطة  
**الموقع:** عام في التطبيق

**التأثير:**
- هجمات Brute Force على تسجيل الدخول
- DDoS attacks
- استنزاف الموارد

**الحل:**
```python
# في Django - أضف django-ratelimit
# pip install django-ratelimit

from django_ratelimit.decorators import ratelimit

@ratelimit(key='ip', rate='5/m', method='POST')
def login_view(request):
    # ...

# في Nginx - أضف limit_req
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

location /api/auth/login {
    limit_req zone=login_limit burst=10 nodelay;
    # ...
}
```

---

### 7. **عدم تحديد حجم الملفات المرفوعة**
**الخطورة:** 🟡 متوسطة  
**الموقع:** `nginx.conf`

```nginx
client_max_body_size 15m;  # موجود فقط في /api-dj/
```

**المشكلة:**
- عدم وجود حد في مسارات أخرى
- إمكانية رفع ملفات ضخمة لاستنزاف المساحة

**الحل:**
```nginx
# أضف حد عام في http block
http {
    client_max_body_size 10m;  # حد عام
    
    # استثناءات محددة حسب الحاجة
    location /api/uploads {
        client_max_body_size 15m;
    }
}
```

---

### 8. **CORS مفتوح جزئياً**
**الخطورة:** 🟡 متوسطة  
**الموقع:** `djangoo/config/settings.py`

```python
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    # ...
]
```

**المشكلة:**
- السماح بـ credentials مع CORS قد يشكل خطر إذا لم تكن Origins محددة بدقة

**الحل:**
```python
# تأكد من تحديد Origins بدقة في الإنتاج
if not DEBUG:
    CORS_ALLOWED_ORIGINS = [
        "https://wtn4.com",
        "https://www.wtn4.com",
        # أضف النطاقات الموثوقة فقط
    ]
    # امنع localhost في الإنتاج
    CORS_ALLOW_ALL_ORIGINS = False
```

---

### 9. **عدم وجود Security Headers كافية**
**الخطورة:** 🟡 متوسطة  
**الموقع:** `nginx.conf`

**الحل المقترح:**
```nginx
# أضف Security Headers في nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

# في Django settings.py
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'SAMEORIGIN'
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

---

### 10. **استخدام __import__ في URLs**
**الخطورة:** 🟡 متوسطة  
**الموقع:** `djangoo/config/urls.py`

```python
path("client/api/", include((__import__('apps.users.client_api_urls', fromlist=['client_api_orders_urlpatterns']).client_api_orders_urlpatterns, 'client_api_orders'))),
```

**المشكلة:**
- كود صعب القراءة
- احتمال أخطاء في الاستيراد الديناميكي

**الحل:**
```python
# استخدم الاستيراد العادي
from apps.users.client_api_urls import client_api_orders_urlpatterns

urlpatterns = [
    path("client/api/", include((client_api_orders_urlpatterns, 'client_api_orders'))),
]
```

---

## 🟢 توصيات عامة (Best Practices)

### 11. **SSL/TLS Configuration**
```nginx
# تأكد من استخدام HTTPS في الإنتاج
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256...';
    ssl_prefer_server_ciphers off;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

### 12. **Password Policies**
```python
# في Django settings.py
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
```

### 13. **Logging & Monitoring**
```python
# أضف logging للأحداث الأمنية
LOGGING = {
    'version': 1,
    'handlers': {
        'security': {
            'level': 'WARNING',
            'class': 'logging.FileHandler',
            'filename': '/var/log/django/security.log',
        },
    },
    'loggers': {
        'django.security': {
            'handlers': ['security'],
            'level': 'WARNING',
        },
    },
}
```

### 14. **Database Security**
```python
# استخدم SSL للاتصال بقاعدة البيانات
DATABASES = {
    'default': {
        # ...
        'OPTIONS': {
            'sslmode': 'require',  # في الإنتاج
            'options': '-c search_path=public,pg_catalog',
        },
    }
}
```

### 15. **Dependencies Security**
```bash
# فحص الثغرات في المكتبات بانتظام

# Python
pip install safety
safety check

# Node.js
npm audit
npm audit fix

# أو استخدم
npx snyk test
```

---

## 📋 خطة العمل الموصى بها

### الأولوية القصوى (فوراً):
1. ✅ تغيير جميع كلمات المرور الافتراضية
2. ✅ توليد SECRET_KEY جديد وقوي
3. ✅ تحديد ALLOWED_HOSTS بدقة
4. ✅ التأكد من DEBUG=0 في الإنتاج
5. ✅ مراجعة استخدام csrf_exempt

### الأولوية العالية (خلال أسبوع):
1. 🔹 إضافة Rate Limiting
2. 🔹 تفعيل HTTPS فقط
3. 🔹 إضافة Security Headers
4. 🔹 تحديث CORS policies
5. 🔹 فحص المكتبات (npm audit / safety check)

### الأولوية المتوسطة (خلال شهر):
1. 🔸 إضافة Logging شامل
2. 🔸 تحسين Password Policies
3. 🔸 مراجعة أذونات المستخدمين
4. 🔸 إضافة Database SSL
5. 🔸 إعداد نظام Monitoring

---

## 🔍 أدوات الفحص الموصى بها

```bash
# فحص أمني شامل
# 1. OWASP ZAP - لفحص الثغرات في التطبيق
# 2. Bandit - لفحص كود Python
pip install bandit
bandit -r djangoo/

# 3. ESLint Security Plugin - لفحص كود JavaScript/TypeScript
npm install --save-dev eslint-plugin-security

# 4. Trivy - لفحص Docker images
trivy image watan-backend:latest

# 5. Git Secrets - للتأكد من عدم وجود أسرار في Git
git secrets --scan
```

---

## ⚠️ ملاحظات مهمة

1. **لا تضع أي أسرار في الكود المصدري أو Git**
2. **استخدم متغيرات البيئة لجميع البيانات الحساسة**
3. **قم بفحص أمني دوري (على الأقل شهرياً)**
4. **احتفظ بنسخ احتياطية مشفرة من قاعدة البيانات**
5. **راجع logs الأمنية بانتظام**

---

## 📞 جهات الاتصال

في حالة اكتشاف ثغرة أمنية:
- لا تشاركها علناً
- أبلغ فريق التطوير فوراً
- وثق الثغرة بالتفصيل

---

**تم إعداد هذا التقرير بواسطة:** GitHub Copilot  
**آخر تحديث:** 16 أكتوبر 2025
