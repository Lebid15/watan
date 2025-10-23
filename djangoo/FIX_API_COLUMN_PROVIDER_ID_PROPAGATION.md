# 🔧 إصلاح مشكلة تغيير عمود API من diana إلى alayaZnet

## 📋 ملخص المشكلة

عند إنشاء طلب من مستخدم **halil** في واجهة **الشام**:
- عمود **API** يُظهر "**diana**" في البداية ✅
- بعد **~10 ثواني**، يتغير إلى "**alayaZnet**" ❌

**مثال:**
```
Order: 704FEC (60b33ccf-d50d-4dab-b46c-2feb11704fec)
User: halil
Package: pubg global 60
Provider shown: diana → alayaZnet (WRONG!)
Expected: diana (STABLE)
```

---

## 🔍 التحليل الشامل

### 1️⃣ **فحص قاعدة البيانات**

```sql
-- Order Details
ID: 60b33ccf-d50d-4dab-b46c-2feb11704fec
User: halil
Package: pubg global 60 (e3ce2ffa-403b-4e25-b43f-48b9a853f5ed)
Tenant ID: 7d37f00a-22f3-4e61-88d7-2a97b79d86fb (ShamTech)
Provider ID: 6d8790a9-9930-4543-80aa-b0b92aa16404 (alayaZnet) ← WRONG!
Status: pending
Mode: MANUAL
Created: 2025-10-21 21:10:12.143785
```

### 2️⃣ **فحص التوجيه (Routing)**

```sql
-- Package Routing
Package ID: e3ce2ffa-403b-4e25-b43f-48b9a853f5ed
Tenant ID: 7d37f00a-22f3-4e61-88d7-2a97b79d86fb
Mode: auto
Provider Type: external
Primary Provider ID: 71544f6c-705e-4e7f-bc3c-c24dc90428b7 ← diana ✅
```

**النتيجة:** التوجيه صحيح! المشكلة ليست في routing.

### 3️⃣ **فحص Dispatch Logs**

من جدول `order_dispatch_log`:

```json
// Log ID: 1999 - DISPATCH (Initial)
{
  "provider": "internal",  // ← diana
  "orderId": "60b33ccf-d50d-4dab-b46c-2feb11704fec"
}

// Log ID: 2004 - DISPATCH SUCCESS
{
  "response": {
    "orderId": "7c950a1a-a765-40eb-b276-1ed179763c3e",  // ← Child order in ShamTech
    "status": "pending"
  }
}

// Log ID: 2006 - CHAIN_STATUS (10 seconds later) ⚠️
{
  "origin": "status_poll",
  "source_order_id": "7c950a1a-a765-40eb-b276-1ed179763c3e",
  "previous": {
    "provider_id": "71544f6c-705e-4e7f-bc3c-c24dc90428b7"  // ← diana
  },
  "next": {
    "provider_id": "6d8790a9-9930-4543-80aa-b0b92aa16404"  // ← alayaZnet
  },
  "updated_fields": ["provider_id", "status", "external_status", ...]
}
```

---

## 🎯 السبب الجذري

### المشكلة في `_apply_chain_updates` (السطر 852-856):

```python
# ❌ OLD CODE (WRONG):
child_provider_id = getattr(source, "provider_id", None)
if propagate_provider_details and child_provider_id and getattr(target, "provider_id", None) != child_provider_id:
    target.provider_id = child_provider_id  # ← This overwrites diana with alayaZnet!
    updated_fields.append("provider_id")
```

### سلسلة الأحداث:

1. **إنشاء الطلب:**
   - User `halil` ينشئ طلب في **Alsham tenant**
   - Routing يُشير إلى **diana** (internal provider)
   - `provider_id` = `71544f6c` (diana) ✅

2. **Dispatch إلى diana:**
   - diana تُنشئ طلب فرعي في **ShamTech tenant**
   - الطلب الفرعي ID: `7c950a1a-a765-40eb-b276-1ed179763c3e`
   - diana تُرسل الطلب الفرعي إلى **alayaZnet** (external provider)
   - الطلب الفرعي `provider_id` = `6d8790a9` (alayaZnet)

3. **Celery Task - check_order_status (بعد 10 ثواني):**
   - يتحقق من حالة الطلب الفرعي
   - يستدعي `_propagate_chain_status`
   - `_apply_chain_updates` ينسخ `provider_id` من child إلى parent
   - الطلب الأصلي `provider_id` يتغير من diana → alayaZnet ❌

4. **Serializer - get_providerName:**
   ```python
   def get_providerName(self, obj) -> str | None:
       provider_id = getattr(obj, 'provider_id', None)  # ← Reads from provider_id field
       # ... queries Integration table ...
   ```
   - يقرأ من `provider_id` field
   - يُرجع اسم المزود من جدول `integrations`
   - النتيجة: **alayaZnet** ❌

---

## ✅ الحل المطبق

### التعديل 1: في `_apply_chain_updates` (services.py:852-856)

```python
# ✅ NEW CODE (FIXED):
# 🔒 FIX: Do NOT propagate provider_id from child to parent!
# The API column should show the FIRST provider the order was routed to,
# not the final downstream provider. When halil creates an order and it's
# forwarded to diana (internal), then diana forwards to alayaZnet (external),
# the API column should show "diana", not "alayaZnet".
# 
# Propagating provider_id was causing the API column to change after a few seconds
# when check_order_status task runs and propagates status from child orders.
#
# REMOVED:
# child_provider_id = getattr(source, "provider_id", None)
# if propagate_provider_details and child_provider_id and getattr(target, "provider_id", None) != child_provider_id:
#     target.provider_id = child_provider_id
#     updated_fields.append("provider_id")
```

### التعديل 2: في `_propagate_forward_completion` (services.py:1170-1178)

```python
# ✅ NEW CODE (FIXED):
# 🔒 FIX: Do NOT propagate provider_id from child to source!
# Same reason as in _apply_chain_updates - the API column should show
# the first provider the order was routed to, not the final provider.
# REMOVED:
# child_provider_id = getattr(child_order, "provider_id", None)
# if child_provider_id and source_order.provider_id != child_provider_id:
#     source_order.provider_id = child_provider_id
#     updated_fields.append("provider_id")
```

---

## 📊 النتيجة المتوقعة

### قبل الإصلاح ❌:
```
Time    | provider_id                           | API Column
--------|---------------------------------------|-------------
T+0s    | 71544f6c (diana)                     | diana
T+10s   | 6d8790a9 (alayaZnet)                 | alayaZnet  ← WRONG!
```

### بعد الإصلاح ✅:
```
Time    | provider_id                           | API Column
--------|---------------------------------------|-------------
T+0s    | 71544f6c (diana)                     | diana
T+10s   | 71544f6c (diana)                     | diana      ← CORRECT!
T+24h   | 71544f6c (diana)                     | diana      ← STABLE!
```

---

## 🔄 الحقول التي يتم نشرها (Chain Propagation)

### ✅ يتم نشرها من child → parent:
- `status` (pending, processing, done, failed)
- `external_status` (sent, processing, completed, etc.)
- `completed_at`
- `last_sync_at`
- `duration_ms`
- `pin_code`
- `provider_message`
- `last_message`
- `manual_note`
- `cost_price_usd`
- `cost_try_at_order`
- `cost_source`
- `chain_path`

### ❌ لا يتم نشرها (بعد الإصلاح):
- `provider_id` ← **المفتاح!**

---

## 🧪 خطوات الاختبار

### 1. إعادة تشغيل Celery:
```powershell
cd f:\watan
.\STOP_ALL_CELERY.ps1
.\START_CELERY_WITH_BEAT.ps1
```

### 2. إنشاء طلب اختبار:
- تسجيل دخول كـ **halil** في Alsham
- إنشاء طلب PUBG 60 أو 660
- مراقبة عمود **API**

### 3. التحقق من الثبات:
```sql
-- Check after 10 seconds, 1 minute, 5 minutes
SELECT 
    id,
    "providerId",
    status,
    "createdAt",
    "updatedAt"
FROM product_orders
WHERE id = '<order_id>';
```

### 4. التحقق من Dispatch Logs:
```sql
SELECT 
    id,
    action,
    result,
    message,
    payload_snapshot,
    created_at
FROM order_dispatch_log
WHERE order_id = '<order_id>'
ORDER BY created_at;
```

**المتوقع:**
- `provider_id` يبقى ثابت على `71544f6c` (diana)
- عمود API يُظهر "**diana**" دائماً
- لا توجد `CHAIN_STATUS` logs تُحدّث `provider_id`

---

## 📝 ملاحظات إضافية

### لماذا نشر الحقول الأخرى مقبول؟

1. **Status Updates**: مهم لإبلاغ المستخدم بتقدم الطلب
2. **Pin Codes**: يجب أن تصل للمستخدم النهائي
3. **Cost Information**: مهم لحسابات الربح/الخسارة
4. **Messages**: تساعد في التشخيص والدعم

### لماذا provider_id خاص؟

- **provider_id** يُمثل **المزود المباشر** الذي تم توجيه الطلب إليه
- في chain forwarding، الطلب يمر عبر عدة مزودات:
  ```
  halil (Alsham) → diana (internal) → alayaZnet (external) → final API
  ```
- المستخدم يجب أن يرى **diana** فقط (المزود الأول)
- التفاصيل الداخلية (alayaZnet) يجب أن تبقى مخفية

### الملفات المعدلة:

```
f:\watan\djangoo\apps\orders\services.py
  - Line ~852-856: Removed provider_id propagation in _apply_chain_updates
  - Line ~1170-1178: Removed provider_id propagation in _propagate_forward_completion
```

---

## ✅ الخلاصة

### المشكلة:
`_apply_chain_updates` كان ينشر `provider_id` من child orders إلى parent orders، مما يسبب تغيير عمود API

### الحل:
إزالة نشر `provider_id` في chain propagation

### النتيجة:
- عمود API يُظهر المزود الأول (diana) ✅
- عمود API يبقى ثابت طوال حياة الطلب ✅
- الحقول المهمة الأخرى تُنشر بشكل صحيح ✅

---

**تاريخ الإصلاح:** 2025-10-22  
**المبرمج:** GitHub Copilot  
**الحالة:** ✅ مطبق ويحتاج اختبار
