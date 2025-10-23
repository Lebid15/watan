# 🔴 ملخص المشكلة: عمود API يظهر "alayaZnet" بدلاً من "diana"

## المشكلة
عند إنشاء طلب من مستخدم **halil** في واجهة **الشام**:
- عمود **API** يُظهر اسم "**alayaZnet**" ❌
- المتوقع: يجب أن يُظهر "**diana**" ✅

**مثال آخر طلب:**
```
Order: 0A7D02
User: halil
Package: pubg global 60
Provider shown: alayaZnet  ← WRONG!
Expected: diana
```

---

## بنية النظام

### هناك شيئان مختلفان باسم "diana":
1. **diana (Integration)** - مزود داخلي Internal Provider:
   - ID: `71544f6c-705e-4e7f-bc3c-c24dc90428b7`
   - Type: `internal`
   - URL: `http://shamtech.localhost:3000/`
   - Tenant: ShamTech (`7d37f00a-22f3-4e61-88d7-2a97b79d86fb`)
   - **هذا هو المزود الذي يجب أن يظهر!**

2. **diana (User)** - مستخدم عادي:
   - مستخدم نهائي في ShamTech tenant
   - ليس له علاقة بالمشكلة

### سير الطلب المتوقع:
```
khalil/halil (Alsham tenant)
    ↓ creates order
    ↓ forwards to...
diana Integration (Internal Provider → ShamTech tenant)
    ↓ dispatches to...
znet provider (External provider)
    ↓ final fulfillment
```

---

## السبب الجذري

### اكتشاف المشكلة:
حزمة **PUBG 660** (وربما غيرها) لديها **routings متعددة**:

```sql
Package: pubg global 660 (acc3681d-80b3-4c30-8c65-6c2a8f8723a4)
Tenant: ShamTech (7d37f00a-22f3-4e61-88d7-2a97b79d86fb)

Routing 1:
  - Mode: auto
  - Provider Type: external
  - Primary Provider ID: 71544f6c-705e-4e7f-bc3c-c24dc90428b7  ← diana ✅

Routing 2:
  - Mode: auto
  - Provider Type: codes
  - Primary Provider ID: None
  - Code Group ID: 1598eb19-ade7-4185-9dfe-6e370bed4d43
```

### المشكلة في الكود:
الكود القديم كان يستخدم:
```python
routing = PackageRouting.objects.get(
    package_id=order.package_id,
    tenant_id=tenant_id
)
```

أو:
```python
routing = PackageRouting.objects.filter(
    package_id=order.package_id,
    tenant_id=tenant_id
).first()
```

**النتيجة:** عند وجود routings متعددة، يختار Django واحد **عشوائياً**:
- أحياناً يختار **external routing** (diana) ✅
- أحياناً يختار **codes routing** (بدون provider_id) ❌

عندما يختار codes routing:
- لا يوجد `primary_provider_id`
- يفشل الـ dispatch أو يستخدم fallback خاطئ
- يحفظ `provider_id` خاطئ في قاعدة البيانات (`6d8790a9` = alayaZnet)

---

## الملفات المتأثرة

### 🔧 تم التعديل في 3 أماكن:

#### 1. `apps/orders/services.py` - السطر ~2038
**الوظيفة:** فحص سريع للـ routing عند إنشاء الطلب

**قبل:**
```python
routing = PackageRouting.objects.get(
    package_id=order.package_id,
    tenant_id=order.tenant_id
)
```

**بعد:**
```python
# ✅ FIX: Prefer external routing when multiple exist
routing = PackageRouting.objects.filter(
    package_id=order.package_id,
    tenant_id=order.tenant_id,
    provider_type='external'
).first()

if not routing:
    routing = PackageRouting.objects.filter(
        package_id=order.package_id,
        tenant_id=order.tenant_id
    ).first()

if not routing:
    raise PackageRouting.DoesNotExist("No routing found")
```

---

#### 2. `apps/orders/services.py` - السطر ~2313
**الوظيفة:** تحميل الـ routing أثناء auto-dispatch

**قبل:**
```python
routing = PackageRouting.objects.get(
    package_id=order.package_id,
    tenant_id=effective_tenant_id
)
```

**بعد:**
```python
# ✅ FIX: When multiple routings exist, prefer external over codes
# Try external provider first
routing = PackageRouting.objects.filter(
    package_id=order.package_id,
    tenant_id=effective_tenant_id,
    provider_type='external'
).first()

# If no external routing, try codes provider
if not routing:
    routing = PackageRouting.objects.filter(
        package_id=order.package_id,
        tenant_id=effective_tenant_id,
        provider_type='codes'
    ).first()

# If still no routing, try manual or any other type
if not routing:
    routing = PackageRouting.objects.filter(
        package_id=order.package_id,
        tenant_id=effective_tenant_id
    ).first()

if not routing:
    raise PackageRouting.DoesNotExist("No routing found")
```

---

#### 3. `apps/orders/tasks.py` - السطر ~230
**الوظيفة:** مهمة Celery للتحقق من حالة الطلب (تعمل بعد ثوانٍ من إنشاء الطلب)

**قبل:**
```python
routing = PackageRouting.objects.using('default').filter(
    package_id=package.id,
    tenant_id=tenant_id
).first()
```

**بعد:**
```python
# ✅ FIX: Prefer external routing when multiple exist
routing = PackageRouting.objects.using('default').filter(
    package_id=package.id,
    tenant_id=tenant_id,
    provider_type='external'
).first()

# If no external routing, try any routing
if not routing:
    routing = PackageRouting.objects.using('default').filter(
        package_id=package.id,
        tenant_id=tenant_id
    ).first()
```

---

## الحل المطبق

### استراتيجية الأولوية:
1. **أولاً:** البحث عن routing بـ `provider_type='external'` (diana)
2. **ثانياً:** البحث عن routing بـ `provider_type='codes'`
3. **ثالثاً:** البحث عن أي routing متاح
4. **إذا لم يوجد:** رفع `PackageRouting.DoesNotExist`

### لماذا هذا يحل المشكلة:
- ✅ **External routing (diana)** يُختار دائماً عند وجوده
- ✅ **Codes routing** يُستخدم فقط كـ fallback
- ✅ عمود API يُظهر "diana" بشكل ثابت
- ✅ لا مزيد من الاختيار العشوائي

---

## الملفات المعدلة بالتفصيل

```
f:\watan\djangoo\apps\orders\services.py
  - السطر 2038-2055: تفضيل external routing في الفحص الأولي
  - السطر 2313-2340: تفضيل external routing في auto_dispatch

f:\watan\djangoo\apps\orders\tasks.py
  - السطر 230-245: تفضيل external routing في check_order_status
```

---

## الطلبات القديمة vs الجديدة

### ⚠️ الطلبات القديمة (قبل الإصلاح):
- محفوظ فيها `provider_id` خاطئ (`6d8790a9` = alayaZnet)
- عمود API سيبقى يُظهر "alayaZnet" ❌
- **حل ممكن:** SQL UPDATE لتصحيح provider_id:
```sql
UPDATE product_orders 
SET "providerId" = '71544f6c-705e-4e7f-bc3c-c24dc90428b7'
WHERE "providerId" = '6d8790a9-9930-4543-80aa-b0b92aa16404'
  AND "tenantId" IN (
    SELECT DISTINCT "tenantId" 
    FROM package_routing 
    WHERE "primaryProviderId" = '71544f6c-705e-4e7f-bc3c-c24dc90428b7'
  );
```

### ✅ الطلبات الجديدة (بعد الإصلاح):
- ستحصل على `provider_id` الصحيح (diana = `71544f6c`)
- عمود API سيُظهر "diana" ✅
- **يجب:** إعادة تشغيل Celery لتطبيق التغييرات

---

## خطوات التحقق

### 1. إعادة تشغيل Celery
```powershell
cd f:\watan
.\STOP_ALL_CELERY.ps1
.\START_CELERY_WITH_BEAT.ps1
```

### 2. إنشاء طلب جديد
- تسجيل دخول كـ **halil** في Alsham
- إنشاء طلب PUBG 60 أو 660
- مراقبة عمود **API**

### 3. التحقق من النتيجة
```python
# التحقق من آخر طلب
cd f:\watan\djangoo
python check_7D90AB_order.py  # أو أي script تشخيصي
```

**المتوقع:**
- عمود API يُظهر "**diana**"
- `provider_id` في DB = `71544f6c-705e-4e7f-bc3c-c24dc90428b7`
- الطلب يُرسل إلى ShamTech ثم znet بنجاح

---

## معلومات إضافية

### IDs المهمة:
```
diana Integration ID:
  71544f6c-705e-4e7f-bc3c-c24dc90428b7

alayaZnet Integration ID (الخاطئ):
  6d8790a9-9930-4543-80aa-b0b92aa16404

ShamTech Tenant ID:
  7d37f00a-22f3-4e61-88d7-2a97b79d86fb

Alsham Tenant ID:
  7d37f00a-7e44-4fc4-98f9-26fb2e1edd29
```

### Provider Types:
- `external` - مزودات خارجية (مثل diana integration)
- `codes` - كودات داخلية (code groups)
- `manual` - يدوي

---

## الخلاصة

### المشكلة:
عمود API يُظهر provider خاطئ بسبب اختيار عشوائي عند وجود routings متعددة

### الحل:
إضافة أولوية لاختيار `provider_type='external'` أولاً في 3 أماكن مختلفة

### النتيجة:
diana يُختار دائماً، عمود API يُظهر الاسم الصحيح

### الحالة:
✅ تم التطبيق في الكود
⏳ يحتاج إعادة تشغيل Celery + اختبار بطلب جديد
