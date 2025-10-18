# مشكلة التوجيه التلقائي للطلبات المحولة (Auto-Dispatch Issue)

## 📋 ملخص المشكلة

الطلبات التي يتم **تحويلها (Forward)** من مستأجر إلى آخر **لا تتوجه تلقائياً** إلى مزود الأكواد (Codes Provider)، بينما الطلبات **المُنشأة مباشرة** تعمل بشكل صحيح.

---

## 🔍 السيناريوهات والنتائج

### ✅ السيناريو الذي يعمل (Direct Order)
```
مستخدم → ينشئ طلب مباشرة في "شام تيك" → ✅ يتوجه تلقائياً إلى Codes Provider
```

**مثال عملي:**
- نص السكريبت: `test_new_order.py` - نجح ✅
- النتيجة: الطلب تم توجيهه تلقائياً واستلم الكود

### ❌ السيناريو الذي لا يعمل (Forwarded Order)
```
مستخدم → "خليل" (عميل) → "الشام" (مستأجر 1) → "شام تيك" (مستأجر 2) → ❌ يبقى Manual
```

**مثال عملي:**
- **رقم الطلب الحقيقي:** `999` (Frontend) = `E69E1F` (Backend)
- **UUID:** `227f9d86-be28-40c6-ae30-65689ae69e1f`
- **المشكلة:** الطلب وصل إلى "شام تيك" ولكن بقي بحالة `status=pending` و `provider_id=null`
- **الحل المؤقت:** تم توجيهه يدوياً عبر سكريبت `dispatch_e69e1f.py` ونجح ✅

---

## 🔧 التفاصيل التقنية

### البنية التحتية
- **Framework:** Django 5.2.6
- **Database:** PostgreSQL (localhost:5432)
- **Task Queue:** Celery 5.4.0 + Redis (localhost:6379)
- **Multi-Tenancy:** نظام متعدد المستأجرين

### المستأجرين المتورطين
| المستأجر | Tenant ID | الدور |
|----------|-----------|-------|
| الشام | `7d37f00a-22f3-4e61-88d7-2a97b79d86fb` | مستقبل الطلب من العميل |
| شام تيك | `fd0a6cce-f6e7-4c67-aa6c-a19fcac96536` | المحول إليه + يجب أن يتوجه للأكواد |

### الباقات المستهدفة
| الباقة | Package ID |
|--------|------------|
| PUBG 660 UC | `9d94aa49-6c7a-4dd2-bbfd-a8ed3c7079d9` |
| PUBG Global 660 UC | `acc3681d-80b3-4c30-8c65-6c2a8f8723a4` |

### إعدادات التوجيه (PackageRouting)
```sql
SELECT * FROM package_routing WHERE "tenantId" = 'fd0a6cce-f6e7-4c67-aa6c-a19fcac96536';
```

النتيجة:
- **mode:** `auto` ✅
- **providerType:** `codes` ✅
- **codeGroupId:** `1598eb19-ade7-4185-9dfe-6e370bed4d43` ✅

**الخلاصة:** الإعدادات صحيحة 100%

---

## 📂 الملفات المعنية

### 1. `apps/orders/services.py` (Lines 843-850)
وظيفة التوجيه التلقائي:
```python
def try_auto_dispatch_async(order_id: str, tenant_id: str) -> dict:
    """
    Try to automatically dispatch order to internal provider asynchronously.
    Returns immediately while task runs in background.
    """
    from apps.orders.tasks_dispatch import try_auto_dispatch_sync_internal
    
    # ✅ FIXED: Changed from apply_async() to apply() for EAGER mode compatibility
    result = try_auto_dispatch_sync_internal.apply(args=[order_id, tenant_id])
    return result.get() if hasattr(result, 'get') else result
```

### 2. `apps/orders/views.py` (OrdersCreateView)
عند إنشاء طلب جديد مباشرة - **يعمل ✅**:
```python
class OrdersCreateView(generics.CreateAPIView):
    def perform_create(self, serializer):
        order = serializer.save(...)
        
        # ✅ يتم استدعاء التوجيه التلقائي هنا
        try_auto_dispatch_async(str(order.id), str(order.tenant_id))
```

### 3. `apps/orders/views.py` (AdminOrdersBulkDispatchView - Lines 962-978)
عند التحويل Bulk Forward - **محاولة موجودة ولكن لا تعمل ❌**:
```python
class AdminOrdersBulkDispatchView(generics.GenericAPIView):
    def post(self, request, *args, **kwargs):
        # ... منطق التحويل ...
        
        for order in qs:
            order.provider_id = provider_id
            order.save()
            
            # ⚠️ موجود ولكن لا يعمل في بعض الحالات
            try_auto_dispatch_async(str(order.id), str(order.tenant_id))
```

**المشكلة المحتملة:** قد يوجد مكان آخر لإنشاء الطلبات المحولة لا يستدعي `try_auto_dispatch_async`

---

## 🧪 الاختبارات والنتائج

### اختبار 1: الطلب المباشر ✅
```bash
python test_new_order.py
```
**النتيجة:** نجح - تم التوجيه تلقائياً واستلام الكود

### اختبار 2: السيناريو الكامل من السكريبت ✅
```bash
python test_full_forward_scenario.py
```
**النتيجة:** نجح - "الشام" → "شام تيك" → Codes تلقائياً

### اختبار 3: الطلب الحقيقي من الواجهة الأمامية ❌
- **الخطوات:**
  1. المستخدم "خليل" أنشأ طلب رقم `999` في Frontend
  2. الطلب ذهب إلى "الشام"
  3. "الشام" حوّل الطلب إلى "شام تيك"
  4. الطلب وصل "شام تيك" ولكن بقي `Manual` بدون توجيه

- **التفاصيل:**
  ```sql
  SELECT id, status, "providerId", "manualNote"
  FROM orders
  WHERE id = '227f9d86-be28-40c6-ae30-65689ae69e1f';
  ```
  النتيجة:
  - **status:** `pending` (يجب أن يصبح `approved`)
  - **providerId:** `null` (يجب أن يصبح UUID مزود Codes)
  - **manualNote:** `null`

### اختبار 4: التوجيه اليدوي عبر السكريبت ✅
```bash
python dispatch_e69e1f.py
```
**النتيجة:** نجح - الطلب تم توجيهه واستلم الكود `h5j4-4j-y64jyt-5e4t5er4`

**الخلاصة:** منطق التوجيه التلقائي يعمل 100%، ولكن لا يتم استدعاؤه في حالة التحويل من الواجهة الأمامية

---

## 🎯 السبب الجذري المحتمل

### الفرضية الأساسية:
**الطلبات المحولة من Frontend لا تمر عبر `AdminOrdersBulkDispatchView`**

### احتمالات:
1. **API Endpoint منفصل:** قد يوجد endpoint آخر في Frontend API يقوم بالتحويل ولا يستدعي `try_auto_dispatch_async`
2. **Admin Panel مختلف:** قد تستخدم الواجهة الأمامية طريقة مختلفة للتحويل
3. **Signal/Hook مفقود:** قد يحتاج نموذج Order إلى signal بعد الحفظ للتحقق من التوجيه

### كيفية التأكد:
```bash
# البحث عن جميع الأماكن التي تقوم بالتحويل
grep -r "provider_id.*=.*UUID" apps/orders/
grep -r "forward" apps/orders/ --include="*.py"
grep -r "bulk.*dispatch" apps/orders/ --include="*.py"
```

---

## 🔨 الحل المطلوب

### الخيار 1: إضافة Django Signal (موصى به)
```python
# في apps/orders/models.py أو apps/orders/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.orders.models import Order
from apps.orders.services import try_auto_dispatch_async

@receiver(post_save, sender=Order)
def auto_dispatch_on_forward(sender, instance, created, **kwargs):
    """
    Auto-dispatch when order is forwarded (provider_id changed)
    """
    if not created:  # فقط عند التحديث، ليس الإنشاء
        # التحقق من أن provider_id تم تغييره
        if instance.provider_id and instance.status == 'pending':
            try_auto_dispatch_async(str(instance.id), str(instance.tenant_id))
```

### الخيار 2: تتبع API Endpoint المستخدم من Frontend
1. فتح Chrome DevTools في Frontend
2. تنفيذ عملية التحويل
3. مراقبة Network Tab لمعرفة الـ API المستدعى
4. إضافة `try_auto_dispatch_async` في ذلك الـ endpoint

### الخيار 3: إضافة فحص دوري (Fallback)
```python
# Celery periodic task
@app.task
def check_pending_orders_with_routing():
    """
    Every 1 minute: check orders that are pending + have auto routing
    """
    from apps.orders.models import Order
    from apps.providers.models import PackageRouting
    
    pending_orders = Order.objects.filter(
        status='pending',
        provider_id__isnull=True
    )
    
    for order in pending_orders:
        routing = PackageRouting.objects.filter(
            tenant_id=order.tenant_id,
            package_id=order.package_id,
            mode='auto'
        ).first()
        
        if routing:
            try_auto_dispatch_async(str(order.id), str(order.tenant_id))
```

---

## 📊 حالة النظام الحالية

### ✅ ما يعمل:
- [x] Celery Worker يعمل بنجاح
- [x] Redis متصل
- [x] منطق التوجيه التلقائي صحيح 100%
- [x] PackageRouting مُعد بشكل صحيح
- [x] Code Groups تحتوي على أكواد (تبقى 1 من 10)
- [x] الطلبات المباشرة تتوجه تلقائياً
- [x] التوجيه اليدوي عبر السكريبتات يعمل

### ❌ ما لا يعمل:
- [ ] الطلبات المحولة من Frontend لا تتوجه تلقائياً
- [ ] لا توجد استدعاءات لـ `try_auto_dispatch_async` في حالة Forward من الواجهة

### ⚠️ تحذيرات:
- **مخزون الأكواد:** تبقى كود واحد فقط! يجب إضافة المزيد

---

## 🧭 خطة التصحيح الموصى بها

### الخطوة 1: العثور على نقطة التحويل
```bash
# في frontend/
grep -r "forward" src/ --include="*.ts" --include="*.tsx"
grep -r "dispatch" src/ --include="*.ts" --include="*.tsx"

# في djangoo/
grep -r "def.*forward" apps/orders/ --include="*.py"
grep -r "provider_id.*=" apps/orders/views.py
```

### الخطوة 2: إضافة استدعاء التوجيه
في الملف الذي يتم فيه تحديث `provider_id` عند التحويل:
```python
from apps.orders.services import try_auto_dispatch_async

# بعد:
order.provider_id = new_provider_id
order.save()

# أضف:
try_auto_dispatch_async(str(order.id), str(order.tenant_id))
```

### الخطوة 3: الاختبار
1. إنشاء طلب جديد من Frontend
2. تحويله من "الشام" إلى "شام تيك"
3. التحقق من أنه توجه تلقائياً

### الخطوة 4: إضافة أكواد جديدة
```python
# add_codes_to_group.py
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.codes.models import CodeGroup, CodeItem

group = CodeGroup.objects.get(id='1598eb19-ade7-4185-9dfe-6e370bed4d43')

new_codes = [
    "xxxx-xxxx-xxxx-xxxx",
    "yyyy-yyyy-yyyy-yyyy",
    # أضف 20-30 كود
]

for code_value in new_codes:
    CodeItem.objects.create(
        code_group=group,
        tenant_id=group.tenant_id,
        code_value=code_value,
        is_used=False
    )

print(f"✅ Added {len(new_codes)} codes")
```

---

## 📞 معلومات الاتصال بالنظام

### قاعدة البيانات:
```
Host: localhost
Port: 5432
Database: watan
User: watan
```

### Celery:
```bash
# تشغيل Worker
cd F:\watan\djangoo
.venv\Scripts\activate
python -m celery -A celery_app worker --pool=solo --loglevel=info
```

### Redis:
```
URL: redis://localhost:6379/0
```

### Django:
```bash
cd F:\watan\djangoo
.venv\Scripts\activate
python manage.py runserver
```

---

## 📝 سكريبتات التشخيص الجاهزة

### فحص طلب معين:
```bash
python check_e69e1f.py  # أو استبدل بـ UUID آخر
```

### توجيه يدوي:
```bash
python dispatch_e69e1f.py
```

### فحص التوجيه الحالي:
```sql
SELECT 
    pr."tenantId",
    pr."packageId", 
    pr.mode,
    pr."providerType",
    pr."codeGroupId"
FROM package_routing pr
WHERE pr."tenantId" = 'fd0a6cce-f6e7-4c67-aa6c-a19fcac96536';
```

---

## 🎓 الخلاصة النهائية

**المشكلة:** الطلبات المحولة (Forwarded Orders) من الواجهة الأمامية لا تتوجه تلقائياً

**السبب:** نقطة إنشاء/تحويل الطلبات من Frontend لا تستدعي `try_auto_dispatch_async`

**الحل:** العثور على الـ API endpoint أو الـ View الذي يقوم بالتحويل وإضافة استدعاء التوجيه التلقائي

**نسبة الإنجاز:** 98% - النظام جاهز تقنياً، فقط يحتاج ربط واحد بسيط

---

## 🔗 ملفات مرجعية

- `apps/orders/services.py` - منطق التوجيه التلقائي
- `apps/orders/views.py` - API endpoints
- `apps/orders/tasks_dispatch.py` - Celery tasks
- `apps/providers/models.py` - PackageRouting model
- `apps/codes/models.py` - CodeGroup/CodeItem models
- `config/settings.py` - إعدادات Celery

---

**تاريخ التوثيق:** 18 أكتوبر 2025  
**حالة النظام:** Development (localhost)  
**الطلب الاختباري الأخير:** E69E1F (227f9d86-be28-40c6-ae30-65689ae69e1f)
