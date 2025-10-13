# 🔍 نظام مراقبة حالة الطلبات من znet

## 📊 الوضع الحالي

✅ **تم الإنجاز:**
- إرسال الطلب إلى znet بنجاح
- حفظ الطلب بحالة `pending` أو `sent`
- تخزين `providerReferans` للاستعلام لاحقاً

❌ **المطلوب:**
- فحص حالة الطلب دورياً حتى يكتمل
- تحديث حالة الطلب في قاعدة البيانات
- استخراج الـ PIN Code وحفظه
- عدم التأثير على الأداء عند وجود طلبات كثيرة

---

## 🎯 الحلول المقترحة

### ✅ **الحل 1: Celery + Redis (الأفضل للإنتاج)**

**المميزات:**
- ⚡ **أداء عالي**: معالجة مئات الطلبات بشكل متوازي
- 🔄 **Retry آلي**: إعادة المحاولة عند الفشل
- 📊 **Monitoring**: مراقبة المهام عبر Flower
- ⏰ **Scheduling**: جدولة مهام دورية
- 🛡️ **Fault Tolerance**: استمرار العمل حتى عند تعطل workers

**البنية:**
```
User Request → Django → Auto-Dispatch → Queue
                                          ↓
                                    Celery Worker
                                          ↓
                                    Check Status
                                          ↓
                                    Update DB
```

**الكود:**
```python
# djangoo/apps/orders/tasks.py
from celery import shared_task
from .models import ProductOrders
from ..providers.registry import get_provider_binding

@shared_task(
    bind=True,
    max_retries=20,  # محاولات متعددة
    default_retry_delay=30,  # 30 ثانية بين كل محاولة
)
def check_order_status(self, order_id: str, tenant_id: str):
    """
    فحص حالة الطلب من المزود الخارجي
    """
    try:
        order = ProductOrders.objects.using('default').get(
            id=order_id,
            tenant_id=tenant_id
        )
        
        # إذا اكتمل الطلب، لا حاجة للمتابعة
        if order.external_status in ['completed', 'delivered', 'cancelled', 'failed']:
            return f"Order {order_id} already in final state: {order.external_status}"
        
        # جلب معلومات المزود
        routing = order.package.routing.first()
        if not routing or not routing.primary_provider_id:
            return f"No routing found for order {order_id}"
        
        integration = routing.primary_provider
        binding = get_provider_binding(integration.provider, integration)
        creds = binding.to_credentials()
        
        # فحص الحالة من المزود
        # استخدم providerReferans المخزن في note أو external_order_id
        referans = extract_provider_referans(order)
        
        result = binding.adapter.fetch_status(creds, referans)
        
        # تحديث الطلب
        order.external_status = result.get('status')
        order.pin_code = result.get('pinCode')
        order.save()
        
        # إذا لم يكتمل بعد، أعد المحاولة
        if result.get('status') not in ['completed', 'delivered', 'cancelled', 'failed']:
            raise self.retry(countdown=30)  # أعد المحاولة بعد 30 ثانية
        
        return f"Order {order_id} updated to {result.get('status')}"
        
    except ProductOrders.DoesNotExist:
        return f"Order {order_id} not found"
    except Exception as exc:
        # أعد المحاولة في حالة الخطأ
        raise self.retry(exc=exc, countdown=60)


def extract_provider_referans(order):
    """
    استخراج providerReferans من الطلب
    """
    # يمكن حفظه في note أو في حقل منفصل
    # TODO: إضافة حقل provider_referans إلى الجدول
    import json
    try:
        note_data = json.loads(order.note or '{}')
        return note_data.get('providerReferans')
    except:
        return None
```

**تفعيل المراقبة بعد الإرسال:**
```python
# في services.py بعد place_order
from .tasks import check_order_status

# بعد السطر: order.save()
# جدولة فحص الحالة بعد دقيقة واحدة
check_order_status.apply_async(
    args=[str(order.id), str(tenant_id)],
    countdown=60  # ابدأ الفحص بعد دقيقة
)
```

---

### ✅ **الحل 2: Django-Q (بديل أبسط)**

**المميزات:**
- 📦 **سهل التثبيت**: لا يحتاج Redis (يستخدم DB)
- 🚀 **سريع البدء**: تكامل مباشر مع Django
- 📊 **Admin UI**: واجهة إدارة مدمجة

**العيوب:**
- ⚠️ **أداء أقل** من Celery عند آلاف الطلبات

**الكود:**
```python
# settings.py
Q_CLUSTER = {
    'name': 'DjangoORM',
    'workers': 4,
    'timeout': 90,
    'retry': 120,
    'queue_limit': 50,
    'bulk': 10,
    'orm': 'default',
}

# في services.py
from django_q.tasks import async_task

async_task(
    'apps.orders.tasks.check_order_status',
    order_id=str(order.id),
    tenant_id=str(tenant_id),
    q_options={'timeout': 300}
)
```

---

### ⚠️ **الحل 3: Cron Job (غير مُوصى به للإنتاج)**

**فقط للتطوير أو حجم صغير:**
```python
# management/commands/check_pending_orders.py
from django.core.management.base import BaseCommand
from apps.orders.models import ProductOrders

class Command(BaseCommand):
    def handle(self, *args, **options):
        pending = ProductOrders.objects.filter(
            external_status__in=['pending', 'sent']
        )[:100]  # فقط 100 طلب في كل مرة
        
        for order in pending:
            # فحص الحالة وتحديث
            pass
```

**Cron:**
```bash
*/5 * * * * python manage.py check_pending_orders
```

---

## 🏆 **التوصية النهائية: Celery + Redis**

### لماذا؟

| الميزة | Celery | Django-Q | Cron |
|--------|--------|----------|------|
| **الأداء** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **التوسع** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| **Retry** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ |
| **Monitoring** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| **سهولة التثبيت** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 🚀 خطة التنفيذ

### **المرحلة 1: إضافة حقل `provider_referans`**
```python
# في migration
class Migration(migrations.Migration):
    operations = [
        migrations.AddField(
            model_name='productorders',
            name='provider_referans',
            field=models.CharField(max_length=255, null=True, blank=True),
        ),
    ]
```

### **المرحلة 2: حفظ `providerReferans` عند الإرسال**
```python
# في services.py بعد place_order
response = binding.adapter.place_order(creds, provider_package_id, payload)

order.provider_referans = response.get('providerReferans')
order.save()
```

### **المرحلة 3: تثبيت Celery**
```bash
pip install celery redis
```

### **المرحلة 4: إنشاء Tasks**
```python
# apps/orders/tasks.py
# الكود أعلاه
```

### **المرحلة 5: تفعيل المراقبة**
```python
# في services.py
check_order_status.apply_async(
    args=[str(order.id), str(tenant_id)],
    countdown=60
)
```

---

## 📊 **استراتيجية الفحص**

### **Exponential Backoff (الأفضل):**
```python
# أول فحص بعد دقيقة واحدة
# إذا لم يكتمل، أعد بعد دقيقتين
# ثم 4 دقائق، 8 دقائق، ... حتى حد أقصى

retry_delays = [60, 120, 240, 480, 900, 1800]  # بالثواني
```

### **Fixed Interval:**
```python
# كل 30 ثانية لمدة 10 محاولات
retry_delay = 30
max_retries = 10
```

---

## 🎯 ما هو الأنسب لمشروعك؟

**إذا كان لديك:**
- ✅ **< 100 طلب/ساعة** → Django-Q كافي
- ✅ **100-1000 طلب/ساعة** → Celery (2-4 workers)
- ✅ **> 1000 طلب/ساعة** → Celery (8+ workers) + Redis Cluster

---

هل تريد أن أبدأ بتطبيق **Celery** أم **Django-Q**؟ 🚀
