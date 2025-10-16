# 🔐 إعدادات الأمان للإنتاج - Django

## ✅ التغييرات المطبقة

تم تطبيق الإصلاحات الأمنية الحرجة التالية:

### 1. حماية من القيم الافتراضية غير الآمنة
- ✅ إضافة فحص `SECRET_KEY` - يمنع استخدام القيمة الافتراضية في الإنتاج
- ✅ إضافة فحص `DEBUG` - يمنع تفعيل DEBUG في الإنتاج
- ✅ إضافة فحص `ALLOWED_HOSTS` - يمنع استخدام "*" في الإنتاج

### 2. إعدادات الأمان
- ✅ تفعيل HTTPS redirect في الإنتاج
- ✅ HSTS Headers (HTTP Strict Transport Security)
- ✅ Security Headers (XSS, Content-Type, X-Frame)
- ✅ Cookie Security (Secure, HttpOnly, SameSite)
- ✅ تقوية متطلبات كلمة المرور (8 أحرف كحد أدنى)

### 3. Logging
- ✅ تسجيل الأحداث الأمنية في `logs/security.log`
- ✅ تسجيل أخطاء الطلبات

### 4. ملفات محدثة
- ✅ `.env.example` - مع تعليمات واضحة للإنتاج
- ✅ `.gitignore` - لحماية الملفات الحساسة

---

## 🚀 خطوات الإطلاق على السيرفر

### الخطوة 1: إنشاء ملف .env للإنتاج

قبل الرفع على السيرفر، قم بإنشاء ملف `.env` في مجلد `djangoo/`:

```bash
# توليد SECRET_KEY
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# توليد JWT_SECRET (في PowerShell)
$bytes = New-Object byte[] 64; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)

# توليد كلمة مرور قوية لـ PostgreSQL
$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

### الخطوة 2: ملف .env للإنتاج

أنشئ `djangoo/.env` على السيرفر:

```env
# ======== CRITICAL: Production Settings ========
ENVIRONMENT=production

# Django Core
DJANGO_SECRET_KEY=<الناتج من الأمر الأول>
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=wtn4.com,*.wtn4.com,api.wtn4.com,watan.games,*.watan.games

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=watan
POSTGRES_USER=watan_prod
POSTGRES_PASSWORD=<كلمة مرور قوية جداً>

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET=<الناتج من الأمر الثاني>
JWT_ACCESS_MIN=60
JWT_REFRESH_DAYS=7

# Public
PUBLIC_TENANT_BASE_DOMAIN=wtn4.com
```

### الخطوة 3: تحديث docker-compose.yml

في السيرفر، تأكد من استخدام متغيرات البيئة:

```yaml
services:
  djangoo:
    env_file:
      - ./djangoo/.env
    # لا تضع قيم ثابتة هنا!
```

### الخطوة 4: التحقق من الإعدادات

قبل التشغيل، تحقق:

```bash
# في مجلد djangoo
python manage.py check --deploy
```

سيعرض لك هذا الأمر جميع المشاكل الأمنية المحتملة.

---

## ⚠️ تحذيرات هامة

### 1. متغيرات البيئة المطلوبة
المشروع **لن يعمل** في الإنتاج إذا لم تضبط:
- `ENVIRONMENT=production`
- `DJANGO_SECRET_KEY` (ليس القيمة الافتراضية)
- `DJANGO_DEBUG=0`
- `DJANGO_ALLOWED_HOSTS` (ليس "*")

### 2. الأخطاء المتوقعة
إذا رأيت هذه الأخطاء، فهذا يعني أن الحماية تعمل:

```
ValueError: ⚠️ DJANGO_SECRET_KEY must be set with a secure value in production!
ValueError: ⚠️ DEBUG mode is not allowed in production! Set DJANGO_DEBUG=0
ValueError: ⚠️ ALLOWED_HOSTS must be specified in production! Do not use '*'
```

### 3. للتطوير المحلي
في بيئة التطوير، **لا تضبط** `ENVIRONMENT=production`:

```env
# في .env للتطوير المحلي
DJANGO_DEBUG=1
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
# لا تضع ENVIRONMENT=production
```

---

## 🔍 الفحص والاختبار

### فحص الإعدادات
```bash
cd djangoo
python manage.py check --deploy
```

### فحص المكتبات
```bash
pip install safety
safety check
```

### اختبار الإعدادات الأمنية
```bash
# تأكد من تفعيل الحماية
python manage.py shell

>>> from django.conf import settings
>>> settings.DEBUG
False  # يجب أن تكون False في الإنتاج
>>> settings.ALLOWED_HOSTS
['wtn4.com', '*.wtn4.com', ...]  # ليس '*'
```

---

## 📝 ملاحظات

1. **جميع التغييرات آمنة** ولا تؤثر على منطق العمل
2. **المشروع سيعمل محلياً** كما هو (بدون `ENVIRONMENT=production`)
3. **الحماية تفعل تلقائياً** عند ضبط `ENVIRONMENT=production`
4. **لا حاجة لتغيير الكود** - فقط ضبط متغيرات البيئة

---

## 🆘 في حالة المشاكل

### المشروع لا يعمل على السيرفر؟

1. تحقق من logs:
   ```bash
   docker logs watan-djangoo
   cat djangoo/logs/security.log
   ```

2. تحقق من متغيرات البيئة:
   ```bash
   docker exec watan-djangoo env | grep DJANGO
   ```

3. تأكد من ملف .env موجود في `djangoo/`

---

**آخر تحديث:** 16 أكتوبر 2025  
**الحالة:** ✅ جاهز للإنتاج (بعد ضبط متغيرات البيئة)
