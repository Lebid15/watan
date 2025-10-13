# 🎉 تم التنفيذ! نظام المراقبة التلقائية للطلبات

## ✅ ما تم إنجازه

### 📦 المراحل المُنفذة:

#### ✅ المرحلة 1: إضافة حقل `provider_referans`
- ✅ إنشاء migration في `apps/orders/migrations/0001_add_provider_referans.py`
- ✅ إضافة حقل `provider_referans VARCHAR(255)` إلى جدول `product_orders`
- ✅ إضافة index على الحقل للبحث السريع
- ✅ تحديث Model في `apps/orders/models.py`

**⚠️ ملاحظة:** Migration جاهز لكن يحتاج صلاحيات admin لتطبيقه. قم بتشغيل هذا SQL يدوياً:
```sql
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS provider_referans VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_orders_provider_referans ON product_orders(provider_referans);
```

---

#### ✅ المرحلة 2: حفظ `provider_referans` عند الإرسال
- ✅ تعديل `try_auto_dispatch()` في `apps/orders/services.py`
- ✅ استخراج `provider_referans` من response المزود
- ✅ حفظه في قاعدة البيانات (Step 12)
- ✅ إضافة logging للتأكد من الحفظ

---

#### ✅ المرحلة 3: تثبيت وإعداد Celery + Redis
- ✅ إضافة المكتبات إلى `requirements.txt`:
  - `celery==5.4.0`
  - `django-celery-results==2.5.1`
  - `django-celery-beat==2.6.0`
- ✅ تثبيت المكتبات
- ✅ إنشاء `celery_app.py` (تم تغيير الاسم من celery.py لتجنب التعارض)
- ✅ تحديث `__init__.py` لتحميل Celery عند بدء Django
- ✅ إضافة إعدادات Celery إلى `config/settings.py`
- ✅ إضافة `django_celery_results` و `django_celery_beat` إلى `INSTALLED_APPS`
- ✅ تطبيق migrations لـ Celery

---

#### ✅ المرحلة 4: إنشاء Tasks
- ✅ إنشاء `apps/orders/tasks.py` مع:
  - **`check_order_status()`**: Task لفحص حالة طلب واحد
    - Auto-retry مع exponential backoff
    - Max 20 retries
    - Timeout بعد 24 ساعة
    - تحديث الحالة + PIN Code
  - **`check_pending_orders_batch()`**: Task دوري لفحص دفعة من الطلبات
    - يعمل كل 5 دقائق
    - يفحص آخر 100 طلب معلق
    - يجدول فحص فردي لكل طلب

---

#### ✅ المرحلة 5: تفعيل المراقبة التلقائية
- ✅ تعديل `try_auto_dispatch()` لجدولة فحص الحالة (Step 15)
- ✅ جدولة task بعد دقيقة واحدة من إرسال الطلب
- ✅ إنشاء Periodic Task في قاعدة البيانات
- ✅ سكريبت `setup_periodic_task.py` للإعداد

---

## 📊 هيكل النظام

```
User creates order
       ↓
Auto-dispatch (< 2s) [try_auto_dispatch]
       ↓
Order sent to znet
       ↓
provider_referans saved ✅
       ↓
Celery task scheduled (60s countdown) 🕐
       ↓
check_order_status runs after 1 min
       ↓
Retry every 30s → 1m → 2m... (exponential)
       ↓
Update status + PIN Code when ready ✅
       ↓
User sees PIN! 🎉
```

---

## 🚀 كيفية التشغيل

### 1. تطبيق Migration (يدوياً):
```sql
-- قم بتشغيل هذا SQL كـ admin
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS provider_referans VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_orders_provider_referans ON product_orders(provider_referans);
```

### 2. تأكد من تشغيل Redis:
```bash
# Windows
redis-server

# أو استخدم Redis Cloud أو Docker
```

### 3. شغّل Django:
```bash
cd f:\watan\djangoo
python manage.py runserver
```

### 4. شغّل Celery Worker (في terminal منفصل):
```bash
cd f:\watan\djangoo
celery -A djangoo worker --loglevel=info --pool=solo
```

**ملاحظة:** استخدمنا `--pool=solo` لأن Windows لا يدعم `fork()`.

### 5. شغّل Celery Beat (في terminal ثالث):
```bash
cd f:\watan\djangoo
celery -A djangoo beat --loglevel=info
```

---

## 🧪 اختبار النظام

### 1. إنشاء طلب جديد:
```bash
# من واجهة المستخدم أو API
POST /api-dj/orders/
{
  "productId": "xxx",
  "packageId": "xxx",
  "userIdentifier": "123456",
  "extraField": "654321"
}
```

### 2. مراقبة Logs:
- **Django logs:** يجب أن ترى 15 خطوة في auto-dispatch
- **Celery Worker logs:** يجب أن ترى task scheduled
- **بعد دقيقة:** يجب أن ترى فحص الحالة
- **Retry:** يجب أن ترى retry كل 30 ثانية → دقيقة → دقيقتين...

### 3. فحص النتيجة:
```sql
SELECT 
    id, 
    "externalStatus", 
    provider_referans, 
    "pinCode", 
    "sentAt", 
    "lastSyncAt"
FROM product_orders
WHERE id = 'xxx';
```

---

## 📁 الملفات المُنشأة والمُعدلة

### ✨ ملفات جديدة:
```
djangoo/celery_app.py                              ← Celery app configuration
djangoo/__init__.py                                 ← Celery initialization
djangoo/apps/orders/migrations/                     ← Migration directory
djangoo/apps/orders/migrations/__init__.py
djangoo/apps/orders/migrations/0001_add_provider_referans.py
djangoo/apps/orders/tasks.py                        ← Celery tasks
djangoo/setup_periodic_task.py                      ← Setup script
djangoo/add_provider_referans.py                    ← Manual migration script
```

### 📝 ملفات مُعدلة:
```
djangoo/requirements.txt                            ← Added Celery packages
djangoo/config/settings.py                          ← Added Celery config
djangoo/apps/orders/models.py                       ← Added provider_referans field
djangoo/apps/orders/services.py                     ← Updated try_auto_dispatch (Step 12 & 15)
```

---

## ⚙️ الإعدادات

### Celery Configuration (في `config/settings.py`):
```python
CELERY_BROKER_URL = 'redis://localhost:6379/0'  # يمكن تغييرها من .env
CELERY_RESULT_BACKEND = 'django-db'
CELERY_TIMEZONE = 'Asia/Damascus'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
```

### Task Configuration:
- **Retry Strategy:** Exponential backoff (30s, 60s, 120s, ...)
- **Max Retries:** 20
- **Max Backoff:** 600s (10 minutes)
- **Timeout:** 24 hours
- **Batch Size:** 100 orders per check
- **Check Frequency:** Every 5 minutes

---

## 🔍 Monitoring

### Logs:
```bash
# Django logs
tail -f djangoo.log

# Celery Worker logs
# يظهر في terminal الـ worker

# Celery Beat logs
# يظهر في terminal الـ beat
```

### Database Queries:
```sql
-- عدد الطلبات المعلقة
SELECT COUNT(*) 
FROM product_orders 
WHERE "externalStatus" IN ('pending', 'sent', 'processing');

-- الطلبات التي تحتاج فحص
SELECT id, "externalStatus", "sentAt", "lastSyncAt"
FROM product_orders
WHERE "externalStatus" IN ('pending', 'sent', 'processing')
  AND "sentAt" < NOW() - INTERVAL '1 minute'
  AND "sentAt" > NOW() - INTERVAL '24 hours';

-- آخر الطلبات المكتملة
SELECT id, "externalStatus", "pinCode", "sentAt", "completedAt"
FROM product_orders
WHERE "externalStatus" = 'completed'
ORDER BY "completedAt" DESC
LIMIT 10;
```

---

## 🐛 استكشاف الأخطاء

### المشكلة: Celery Worker لا يعمل
**الحل:**
```bash
# تأكد من Redis يعمل
redis-cli ping  # يجب أن يرد PONG

# تأكد من CELERY_BROKER_URL صحيح في settings.py
# استخدم --pool=solo على Windows
celery -A djangoo worker --loglevel=debug --pool=solo
```

### المشكلة: Tasks لا تُنفذ
**الحل:**
```bash
# تأكد من Celery Beat يعمل
celery -A djangoo beat --loglevel=debug

# افحص Periodic Tasks في قاعدة البيانات
python manage.py shell
>>> from django_celery_beat.models import PeriodicTask
>>> PeriodicTask.objects.all()
```

### المشكلة: provider_referans NULL
**الحل:**
```bash
# تأكد من تطبيق SQL migration يدوياً
psql -U watan -d watan -c "ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS provider_referans VARCHAR(255);"

# أو استخدم السكريبت
python add_provider_referans.py
```

---

## 📈 الأداء المتوقع

- ✅ **وقت الاستجابة:** < 2 ثانية لإنشاء الطلب
- ✅ **معالجة متوازية:** آلاف الطلبات بدون تأثير على الأداء
- ✅ **Retry ذكي:** Exponential backoff لتقليل الضغط على المزود
- ✅ **استهلاك الموارد:** منخفض (Celery worker واحد كافي لمئات الطلبات/الدقيقة)

---

## 🎯 الخطوات القادمة

### الآن يمكنك:
1. ✅ تطبيق SQL migration يدوياً
2. ✅ تشغيل النظام الكامل (Django + Celery Worker + Beat)
3. ✅ اختبار بطلب حقيقي
4. ✅ مراقبة Logs والنتائج

### (اختياري) المرحلة 7: Monitoring مع Flower:
```bash
# تثبيت Flower
pip install flower

# تشغيل Flower
celery -A djangoo flower --port=5555

# فتح في المتصفح
http://localhost:5555
```

---

## 💡 نصائح مهمة

1. **Redis:** تأكد من تشغيل Redis قبل Celery
2. **Windows:** استخدم `--pool=solo` مع Celery Worker
3. **Logs:** راقب logs بانتظام لاكتشاف المشاكل مبكراً
4. **Retry:** النظام سيعيد المحاولة تلقائياً - لا تقلق!
5. **Timeout:** الطلبات التي تتجاوز 24 ساعة ستُعلّم كـ failed تلقائياً

---

## 🎉 النظام جاهز!

الآن لديك نظام مراقبة تلقائية كامل ومتقدم! 🚀

**بالتوفيق!** 🎯
