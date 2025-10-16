# ⚡ دليل الإطلاق السريع على السيرفر

## قبل الرفع على السيرفر

### 1️⃣ توليد الأسرار (على جهازك المحلي)

```powershell
# توليد Django SECRET_KEY
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# توليد JWT_SECRET
$bytes = New-Object byte[] 64
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)

# توليد PostgreSQL Password
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

**⚠️ احفظ هذه القيم في مكان آمن!**

---

## على السيرفر

### 2️⃣ إنشاء ملف .env

```bash
# في مجلد watan/djangoo/
nano .env
```

الصق هذا المحتوى وعدّل القيم:

```env
# ========================================
# إعدادات الإنتاج - Production Settings
# ========================================

ENVIRONMENT=production

# Django
DJANGO_SECRET_KEY=<القيمة المولدة - 50+ حرف>
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=wtn4.com,*.wtn4.com,api.wtn4.com,watan.games,*.watan.games

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=watan
POSTGRES_USER=watan_prod
POSTGRES_PASSWORD=<كلمة مرور قوية>

# Redis & Celery
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0

# JWT
JWT_SECRET=<القيمة المولدة - 64+ حرف>
JWT_ACCESS_MIN=60
JWT_REFRESH_DAYS=7

# Public
PUBLIC_TENANT_BASE_DOMAIN=wtn4.com
FRONTEND_BASE_URL=https://wtn4.com

# Email (اضبط حسب مزود البريد)
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USE_TLS=1
# EMAIL_HOST_USER=your-email@gmail.com
# EMAIL_HOST_PASSWORD=your-app-password
```

احفظ الملف (`Ctrl+O` ثم `Enter` ثم `Ctrl+X`)

### 3️⃣ تحديث docker-compose.yml

تأكد من أن قسم `djangoo` يستخدم `.env`:

```yaml
djangoo:
  env_file:
    - ./djangoo/.env
  # حذف أي environment variables ثابتة
```

وفي قسم `postgres`، استخدم متغيرات البيئة:

```yaml
postgres:
  environment:
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

### 4️⃣ التحقق قبل التشغيل

```bash
# تحقق من الملف
cat djangoo/.env | grep ENVIRONMENT
# يجب أن يظهر: ENVIRONMENT=production

cat djangoo/.env | grep DEBUG
# يجب أن يظهر: DJANGO_DEBUG=0

# فحص أمني
cd djangoo
python manage.py check --deploy
```

### 5️⃣ إعادة تشغيل الخدمات

```bash
# العودة للمجلد الرئيسي
cd ..

# إيقاف الخدمات
docker-compose down

# بناء وتشغيل
docker-compose up -d --build

# متابعة logs للتأكد
docker logs -f watan-djangoo
```

---

## ✅ التحقق من نجاح التشغيل

### 1. تحقق من الحالة
```bash
docker ps
# يجب أن ترى جميع الخدمات "Up"
```

### 2. تحقق من logs
```bash
# Django logs
docker logs watan-djangoo

# يجب ألا ترى أخطاء مثل:
# ❌ ValueError: DJANGO_SECRET_KEY must be set
# ❌ ValueError: DEBUG mode is not allowed
```

### 3. اختبار API
```bash
curl https://api.wtn4.com/api-dj/health
# يجب أن يرجع 200 OK
```

---

## 🔒 نقاط الأمان الحرجة

### ✅ تم التطبيق تلقائياً:
- ✅ فحص SECRET_KEY في الإنتاج
- ✅ فحص DEBUG=0 في الإنتاج  
- ✅ فحص ALLOWED_HOSTS في الإنتاج
- ✅ تفعيل HTTPS redirect
- ✅ تفعيل Security Headers
- ✅ Cookie Security
- ✅ Security Logging

### ⚙️ يحتاج ضبط منك:
- ⚙️ متغيرات `.env` (SECRET_KEY, JWT_SECRET, POSTGRES_PASSWORD)
- ⚙️ ALLOWED_HOSTS (حدد النطاقات)
- ⚙️ شهادة SSL/TLS (Let's Encrypt)

---

## 🚨 إذا ظهرت مشاكل

### الخطأ: "SECRET_KEY must be set"
```bash
# تأكد من وجود الملف
ls -la djangoo/.env

# تأكد من القيمة
grep DJANGO_SECRET_KEY djangoo/.env
```

### الخطأ: "DEBUG mode is not allowed"
```bash
# عدّل الملف
nano djangoo/.env
# غيّر DJANGO_DEBUG=0
```

### الخطأ: "ALLOWED_HOSTS must be specified"
```bash
# عدّل الملف
nano djangoo/.env
# غيّر DJANGO_ALLOWED_HOSTS=wtn4.com,*.wtn4.com,...
```

### Container يتوقف فوراً
```bash
# شاهد السبب
docker logs watan-djangoo --tail 50
```

---

## 📞 قائمة التحقق النهائية

قبل اعتبار السيرفر جاهز:

- [ ] تم توليد `DJANGO_SECRET_KEY` جديد
- [ ] تم توليد `JWT_SECRET` جديد  
- [ ] تم توليد `POSTGRES_PASSWORD` قوي
- [ ] تم إنشاء ملف `djangoo/.env` على السيرفر
- [ ] `ENVIRONMENT=production` في `.env`
- [ ] `DJANGO_DEBUG=0` في `.env`
- [ ] `DJANGO_ALLOWED_HOSTS` محدد (ليس "*")
- [ ] جميع الـ containers تعمل (`docker ps`)
- [ ] لا توجد أخطاء في logs
- [ ] API تستجيب بشكل صحيح
- [ ] HTTPS يعمل (شهادة SSL مثبتة)

---

**✅ إذا تمت جميع النقاط، السيرفر جاهز وآمن!**

**آخر تحديث:** 16 أكتوبر 2025
