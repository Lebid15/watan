# 📋 خطة العمل الكاملة: نظام المراقبة التلقائية للطلبات

## 🎯 الهدف النهائي
بناء نظام **مراقبة تلقائية** لحالة الطلبات المُرسلة إلى المزود الخارجي (znet) دون التأثير على أداء النظام.

---

## ✅ ما تم إنجازه حتى الآن

### 1. **Auto-Dispatch System** ✅
- ✅ إنشاء دالة `try_auto_dispatch()` في `djangoo/apps/orders/services.py`
- ✅ تكامل مع `OrdersCreateView.post()` لإرسال تلقائي عند إنشاء طلب
- ✅ 14 خطوة مع logging تفصيلي لكل مرحلة
- ✅ جلب `oyun` و `kupur` من metadata المنتجات
- ✅ بناء payload صحيح وإرساله إلى znet

### 2. **إصلاح مشاكل الإرسال** ✅
- ✅ تصحيح البحث عن المنتج من `packageExternalId` إلى `externalId`
- ✅ استخراج `oyun` من `meta.oyun_bilgi_id`
- ✅ استخراج `kupur` من `meta.kupur`
- ✅ تعديل `znet.py` لاستخدام `oyun` و `kupur` من `payload.params`
- ✅ استخدام `referans` رقمي (timestamp) بدلاً من UUID

### 3. **الملفات المُعدلة** ✅
```
djangoo/apps/orders/services.py    ← try_auto_dispatch() + 14 steps logging
djangoo/apps/orders/views.py       ← تكامل auto-dispatch مع OrdersCreateView
djangoo/apps/providers/adapters/znet.py  ← إصلاحات oyun/kupur/referans
```

### 4. **النتيجة الحالية** ✅
```
🎉 الطلبات تُرسل بنجاح إلى znet!
✅ Response: {'status': 'sent', 'note': 'OK|cost=37.60|balance=...'}
```

---

## 🚀 المرحلة القادمة: نظام المراقبة

### **المشكلة:**
- الطلب يُرسل بحالة `sent` أو `pending`
- لا يوجد نظام لفحص الحالة النهائية (completed/failed)
- لا يوجد استخراج PIN Code من المزود
- عند وجود مئات الطلبات، نحتاج نظام ذكي لا يؤثر على الأداء

---

## 📝 الخطة التفصيلية

### **المرحلة 1: إضافة حقل `provider_referans`** 
**المدة:** 10 دقائق

**الهدف:** حفظ الرقم المرجعي الذي أرسلناه للمزود

**الخطوات:**
```bash
1. إنشاء migration جديد:
   python manage.py makemigrations orders --empty -n add_provider_referans

2. تعديل الـ migration:
   - إضافة حقل provider_referans (CharField, 255, nullable)
   - إضافة index على الحقل للبحث السريع

3. تطبيق Migration:
   python manage.py migrate
```

**الملفات المتأثرة:**
- `djangoo/apps/orders/migrations/XXXX_add_provider_referans.py` (جديد)
- `djangoo/apps/orders/models.py` (تحديث managed=False model documentation)

**الكود المطلوب:**
```python
# في migration
operations = [
    migrations.RunSQL(
        """
        ALTER TABLE product_orders 
        ADD COLUMN IF NOT EXISTS provider_referans VARCHAR(255);
        
        CREATE INDEX IF NOT EXISTS idx_orders_provider_referans 
        ON product_orders(provider_referans);
        """,
        reverse_sql="""
        DROP INDEX IF EXISTS idx_orders_provider_referans;
        ALTER TABLE product_orders DROP COLUMN IF EXISTS provider_referans;
        """
    ),
]
```

---

### **المرحلة 2: حفظ `providerReferans` عند الإرسال**
**المدة:** 15 دقائق

**الهدف:** تخزين الرقم المرجعي للاستعلام لاحقاً

**الخطوات:**
```bash
1. تعديل services.py في try_auto_dispatch()
2. بعد استدعاء place_order()، استخراج providerReferans من response
3. حفظه في order.provider_referans
4. إضافة logging للتأكد من الحفظ
```

**الملفات المتأثرة:**
- `djangoo/apps/orders/services.py` (تحديث)

**الكود المطلوب:**
```python
# في services.py - بعد السطر الذي يحتوي على:
# response = binding.adapter.place_order(...)

# استخراج providerReferans
provider_referans = response.get('providerReferans')
if provider_referans:
    order.provider_referans = provider_referans
    order.save(update_fields=['provider_referans'])
    print(f"   ✅ Saved provider_referans: {provider_referans}")
```

---

### **المرحلة 3: تثبيت وإعداد Celery + Redis**
**المدة:** 30 دقيقة

**الهدف:** إعداد البنية التحتية للمهام الخلفية

**الخطوات:**

#### 3.1 تثبيت المكتبات
```bash
pip install celery redis django-celery-results django-celery-beat
pip freeze > requirements.txt
```

#### 3.2 إنشاء ملف Celery
**الملف:** `djangoo/celery.py`
```python
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('djangoo')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
```

#### 3.3 تعديل `__init__.py`
**الملف:** `djangoo/__init__.py`
```python
from .celery import app as celery_app

__all__ = ('celery_app',)
```

#### 3.4 إضافة إعدادات Celery
**الملف:** `djangoo/config/settings.py`
```python
# Celery Configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'default'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Damascus'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60

# Celery Beat (Periodic Tasks)
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# في INSTALLED_APPS
INSTALLED_APPS = [
    # ... باقي التطبيقات
    'django_celery_results',
    'django_celery_beat',
]
```

#### 3.5 تطبيق Migrations
```bash
python manage.py migrate django_celery_results
python manage.py migrate django_celery_beat
```

#### 3.6 اختبار Celery
```bash
# في terminal منفصل
celery -A djangoo worker --loglevel=info

# في terminal آخر
celery -A djangoo beat --loglevel=info
```

**الملفات المتأثرة:**
- `djangoo/celery.py` (جديد)
- `djangoo/__init__.py` (تحديث)
- `djangoo/config/settings.py` (تحديث)
- `requirements.txt` (تحديث)

---

### **المرحلة 4: إنشاء Task لفحص حالة الطلبات**
**المدة:** 45 دقيقة

**الهدف:** مهمة خلفية تفحص الطلبات وتحدث حالتها

**الخطوات:**

#### 4.1 إنشاء ملف Tasks
**الملف:** `djangoo/apps/orders/tasks.py` (جديد)

```python
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

from .models import ProductOrders
from ..providers.models import PackageRouting
from ..providers.registry import get_provider_binding

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=20,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def check_order_status(self, order_id: str, tenant_id: str, attempt: int = 1):
    """
    فحص حالة طلب واحد من المزود الخارجي
    
    Args:
        order_id: UUID الطلب
        tenant_id: UUID المستأجر
        attempt: رقم المحاولة (للـ logging)
    """
    logger.info(f"🔍 [Attempt {attempt}] Checking status for order: {order_id}")
    
    try:
        # 1. جلب الطلب
        order = ProductOrders.objects.using('default').get(
            id=order_id,
            tenant_id=tenant_id
        )
        
        # 2. التحقق من الحالة النهائية
        final_statuses = ['completed', 'delivered', 'cancelled', 'failed', 'rejected']
        if order.external_status in final_statuses:
            logger.info(f"✅ Order {order_id} already in final state: {order.external_status}")
            return {
                'order_id': order_id,
                'status': order.external_status,
                'message': 'Already in final state'
            }
        
        # 3. التحقق من عدم تجاوز الحد الزمني (24 ساعة)
        if order.sent_at:
            time_since_sent = timezone.now() - order.sent_at
            if time_since_sent > timedelta(hours=24):
                logger.warning(f"⏰ Order {order_id} exceeded 24h, marking as failed")
                order.external_status = 'failed'
                order.note = (order.note or '') + ' | Timeout: No response after 24h'
                order.save(update_fields=['external_status', 'note'])
                return {
                    'order_id': order_id,
                    'status': 'failed',
                    'message': 'Timeout after 24 hours'
                }
        
        # 4. التحقق من وجود provider_referans
        if not order.provider_referans:
            logger.error(f"❌ Order {order_id} missing provider_referans")
            return {
                'order_id': order_id,
                'status': 'error',
                'message': 'Missing provider_referans'
            }
        
        # 5. جلب معلومات المزود
        package = order.package
        if not package:
            logger.error(f"❌ Order {order_id} has no package")
            return {'order_id': order_id, 'status': 'error', 'message': 'No package'}
        
        routing = PackageRouting.objects.using('default').filter(
            package_id=package.id,
            tenant_id=tenant_id
        ).first()
        
        if not routing or not routing.primary_provider_id:
            logger.error(f"❌ No routing found for order {order_id}")
            return {'order_id': order_id, 'status': 'error', 'message': 'No routing'}
        
        integration = routing.primary_provider
        
        # 6. استدعاء adapter
        binding = get_provider_binding(integration.provider, integration)
        creds = binding.to_credentials()
        
        logger.info(f"📡 Fetching status from {integration.provider} for referans: {order.provider_referans}")
        
        result = binding.adapter.fetch_status(creds, order.provider_referans)
        
        logger.info(f"📥 Provider response: {result}")
        
        # 7. تحديث حالة الطلب
        old_status = order.external_status
        new_status = result.get('status')
        pin_code = result.get('pinCode')
        message = result.get('message')
        
        updated_fields = []
        
        if new_status and new_status != old_status:
            order.external_status = new_status
            updated_fields.append('external_status')
            logger.info(f"🔄 Status changed: {old_status} → {new_status}")
        
        if pin_code and pin_code != order.pin_code:
            order.pin_code = pin_code
            updated_fields.append('pin_code')
            logger.info(f"🔑 PIN Code received: {pin_code[:10]}...")
        
        if message:
            order.note = (order.note or '') + f" | {message}"
            updated_fields.append('note')
        
        if updated_fields:
            order.save(update_fields=updated_fields)
            logger.info(f"💾 Order {order_id} updated: {updated_fields}")
        
        # 8. تحديد ما إذا كان يجب إعادة المحاولة
        if new_status not in final_statuses:
            logger.info(f"⏳ Order {order_id} still pending, will retry...")
            # استخدام exponential backoff
            countdown = min(30 * (2 ** (attempt - 1)), 600)  # max 10 minutes
            raise self.retry(countdown=countdown, kwargs={'attempt': attempt + 1})
        
        return {
            'order_id': order_id,
            'status': new_status,
            'pin_code': pin_code,
            'message': 'Status updated successfully'
        }
        
    except ProductOrders.DoesNotExist:
        logger.error(f"❌ Order {order_id} not found in database")
        return {'order_id': order_id, 'status': 'error', 'message': 'Order not found'}
    
    except Exception as exc:
        logger.exception(f"❌ Error checking order {order_id}: {exc}")
        # Celery سيعيد المحاولة تلقائياً بسبب autoretry_for
        raise


@shared_task
def check_pending_orders_batch():
    """
    فحص دفعة من الطلبات المعلقة (يُنفذ دورياً كل 5 دقائق)
    """
    logger.info("🔍 Starting batch check for pending orders...")
    
    # جلب الطلبات المعلقة التي مر عليها أكثر من دقيقة
    one_minute_ago = timezone.now() - timedelta(minutes=1)
    
    pending_orders = ProductOrders.objects.using('default').filter(
        external_status__in=['pending', 'sent'],
        sent_at__isnull=False,
        sent_at__lte=one_minute_ago,
        sent_at__gte=timezone.now() - timedelta(hours=24)  # آخر 24 ساعة فقط
    )[:100]  # فقط 100 طلب في كل دفعة
    
    count = pending_orders.count()
    logger.info(f"📊 Found {count} pending orders to check")
    
    # جدولة فحص لكل طلب
    for order in pending_orders:
        check_order_status.apply_async(
            args=[str(order.id), str(order.tenant_id)],
            countdown=5  # توزيع الطلبات على 5 ثواني
        )
    
    return {
        'checked': count,
        'message': f'Scheduled {count} order checks'
    }
```

**الملفات المتأثرة:**
- `djangoo/apps/orders/tasks.py` (جديد)

---

### **المرحلة 5: تفعيل المراقبة التلقائية**
**المدة:** 20 دقيقة

**الهدف:** جدولة فحص الحالة بعد إرسال الطلب

**الخطوات:**

#### 5.1 تعديل `try_auto_dispatch()` في services.py
```python
# في نهاية دالة try_auto_dispatch()، بعد Step 14

# Step 15: جدولة فحص الحالة
from .tasks import check_order_status

print(f"\n⏰ Step 15: Scheduling status check...")
check_order_status.apply_async(
    args=[str(order.id), str(tenant_id)],
    countdown=60  # ابدأ الفحص بعد دقيقة واحدة
)
print(f"   ✅ Status check scheduled for 1 minute from now")
```

#### 5.2 إنشاء Periodic Task للفحص الدوري
```bash
# في Django shell أو Admin
python manage.py shell
```

```python
from django_celery_beat.models import PeriodicTask, IntervalSchedule

# إنشاء جدول كل 5 دقائق
schedule, created = IntervalSchedule.objects.get_or_create(
    every=5,
    period=IntervalSchedule.MINUTES,
)

# إنشاء المهمة الدورية
PeriodicTask.objects.get_or_create(
    name='Check pending orders batch',
    task='apps.orders.tasks.check_pending_orders_batch',
    interval=schedule,
    enabled=True,
)
```

**الملفات المتأثرة:**
- `djangoo/apps/orders/services.py` (تحديث)

---

### **المرحلة 6: اختبار النظام**
**المدة:** 30 دقيقة

**الخطوات:**

#### 6.1 تشغيل الخدمات
```bash
# Terminal 1: Django
python manage.py runserver

# Terminal 2: Celery Worker
celery -A djangoo worker --loglevel=info --pool=solo

# Terminal 3: Celery Beat
celery -A djangoo beat --loglevel=info
```

#### 6.2 إنشاء طلب تجريبي
```bash
# من واجهة المستخدم أو API
POST /api-dj/orders/
{
  "productId": "...",
  "packageId": "...",
  "userIdentifier": "123456",
  "extraField": "654321"
}
```

#### 6.3 مراقبة Logs
```
# يجب أن ترى:
1. ✅ Auto-dispatch في Django logs
2. ✅ Task scheduled في Celery logs
3. ⏳ Status check بعد دقيقة
4. 🔄 Retry كل 30 ثانية حتى يكتمل
5. ✅ Final status update
```

---

### **المرحلة 7: إضافة Monitoring (اختياري)**
**المدة:** 20 دقيقة

**الهدف:** واجهة لمراقبة المهام

#### 7.1 تثبيت Flower
```bash
pip install flower
```

#### 7.2 تشغيل Flower
```bash
celery -A djangoo flower --port=5555
```

#### 7.3 فتح Flower في المتصفح
```
http://localhost:5555
```

---

## 📊 ملخص الملفات المتأثرة

### **ملفات جديدة:**
```
djangoo/celery.py
djangoo/apps/orders/tasks.py
djangoo/apps/orders/migrations/XXXX_add_provider_referans.py
```

### **ملفات مُحدثة:**
```
djangoo/__init__.py
djangoo/config/settings.py
djangoo/apps/orders/services.py
djangoo/apps/orders/models.py (documentation only)
requirements.txt
```

### **خدمات جديدة:**
```
Celery Worker (background)
Celery Beat (scheduler)
Redis (message broker)
Flower (monitoring - اختياري)
```

---

## 🎯 النتيجة المتوقعة

### **عند إنشاء طلب:**
```
1. المستخدم ينشئ طلب → 201 Created (فوري)
2. Auto-dispatch يُرسل الطلب → znet (< 2 ثانية)
3. الطلب يُحفظ بحالة 'sent' مع provider_referans
4. Task يُجدول للفحص بعد دقيقة
5. بعد دقيقة: فحص الحالة من znet
6. إذا لم يكتمل: إعادة كل 30 ثانية → دقيقة → دقيقتين... (exponential backoff)
7. عند الاكتمال: تحديث الحالة + حفظ PIN Code
8. المستخدم يرى الـ PIN في واجهته
```

### **الأداء:**
- ✅ **لا تأخير** في إنشاء الطلب (< 2 ثانية)
- ✅ **معالجة متوازية** لآلاف الطلبات
- ✅ **Retry ذكي** مع exponential backoff
- ✅ **استهلاك منخفض** للموارد

---

## ⚠️ نقاط مهمة للمحادثة القادمة

### **سأحتاج منك:**
1. ✅ تأكيد اختيار Celery (أم تفضل Django-Q؟)
2. ✅ تحديد استراتيجية Retry (exponential backoff أم fixed interval؟)
3. ✅ هل Redis متوفر أم نحتاج تثبيته؟
4. ✅ هل تريد Flower للـ monitoring؟

### **سأبدأ بـ:**
1. المرحلة 1: إضافة حقل provider_referans
2. المرحلة 2: حفظ providerReferans عند الإرسال
3. ثم نتأكد من النتائج قبل المتابعة

---

## 📝 ملاحظات للمحادثة القادمة

### **ابدأ المحادثة بـ:**
```
مرحباً! أريد استكمال خطة نظام المراقبة التلقائية للطلبات.
الخطة موجودة في: djangoo/MONITORING_IMPLEMENTATION_PLAN.md

الوضع الحالي:
- ✅ Auto-dispatch يعمل بنجاح
- ✅ الطلبات تُرسل إلى znet بنجاح
- 🎯 نريد إضافة نظام فحص تلقائي للحالة

هل أنت جاهز لبدء المرحلة 1؟
```

### **المعلومات المهمة:**
- **الملفات الرئيسية:**
  - `djangoo/apps/orders/services.py` (try_auto_dispatch)
  - `djangoo/apps/providers/adapters/znet.py` (place_order, fetch_status)
  
- **الجداول:**
  - `product_orders` (جدول الطلبات)
  - حقول مهمة: id, tenant_id, external_status, sent_at, pin_code, note
  
- **المزود:**
  - znet (Turkish game credits provider)
  - لديه `fetch_status()` جاهز في adapter
  - يعيد: {status, pinCode, message}

---

## 🚀 الخطوة التالية

**في المحادثة الجديدة، قل:**
> "أريد تنفيذ خطة المراقبة. الخطة في `MONITORING_IMPLEMENTATION_PLAN.md`. ابدأ بالمرحلة 1: إضافة حقل provider_referans"

**وأنا سأبدأ فوراً!** 🎯
