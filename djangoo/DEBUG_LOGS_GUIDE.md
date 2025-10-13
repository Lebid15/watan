# 🔍 دليل قراءة Logs التوجيه التلقائي

## 📌 الآن عند إنشاء طلب، ستظهر رسائل مفصلة في Terminal

### 🎯 مراحل التنفيذ (14 خطوة)

#### 1️⃣ **بداية العملية**
```
================================================================================
🚀 AUTO-DISPATCH START: Order ID = <uuid>
================================================================================
```

#### 2️⃣ **جلب الطلب**
```
📦 Step 1: Fetching order...
   ✅ Order found: <uuid>
   - Status: pending
   - Package ID: <uuid>
   - User Identifier: <value>
   - Extra Field: <value>
```

#### 3️⃣ **التحقق من المستأجر**
```
📋 Step 2: Verifying tenant...
   ✅ Tenant verified: <tenant-id>
```

#### 4️⃣ **فحص حالة الطلب**
```
🔍 Step 3: Checking if order was already dispatched...
   ✅ Order is pending and not yet dispatched
```

#### 5️⃣ **قراءة إعدادات PackageRouting**
```
⚙️ Step 4: Loading PackageRouting configuration...
   ✅ PackageRouting found!
   - Mode: auto
   - Provider Type: external
   - Primary Provider ID: <uuid>
```

#### 6️⃣ **التحقق من الإعدادات**
```
✓ Step 5: Validating routing configuration...
   ✅ Mode is 'auto'
   ✅ Provider type is 'external'
   ✅ Primary Provider ID: <uuid>
```

#### 7️⃣ **قراءة PackageMapping**
```
🔗 Step 6: Loading PackageMapping...
   ✅ PackageMapping found!
   - Provider Package ID: <external-id>
```

#### 8️⃣ **قراءة Integration**
```
🔌 Step 7: Loading Integration details...
   ✅ Integration found!
   - Provider: znet
   - Base URL: <url>
   - Has kod: True
   - Has sifre: True
```

#### 9️⃣ **إعداد Adapter**
```
🔑 Step 8: Resolving adapter credentials...
   ✅ Adapter credentials resolved!
   - Adapter: ZnetAdapter
   - Credentials type: ZnetCredentials
```

#### 🔟 **بناء Payload**
```
📤 Step 9: Building payload...
   ✅ Payload built:
   - Product ID: <external-package-id>
   - Quantity: 1
   - Order ID (referans): <uuid>
   - User Identifier: <value>
   - Extra Field: <value>
   - Full payload: {...}
```

#### 1️⃣1️⃣ **قراءة التكلفة**
```
💰 Step 10: Loading cost information...
   ✅ PackageCost found: 1.50 USD
```

#### 1️⃣2️⃣ **إرسال الطلب للمزود** ⭐ **المرحلة الأهم**
```
🚀 Step 11: SENDING ORDER TO PROVIDER...
   - Provider: znet
   - Provider Package ID: <external-id>
   - Payload: {...}

   📡 Calling adapter.place_order()...
```

**هنا يحدث الاتصال الفعلي مع المزود الخارجي!**

#### 1️⃣3️⃣ **معالجة رد المزود**
```
   ✅ Provider responded!
   - Response: {...}

📝 Step 12: Processing provider response...
   - External Order ID: <external-id>
   - Status (raw): sent
   - Note: OK|cost=1.23|balance=111.11
   - External Status (mapped): sent
   - Cost from provider: 1.23
   - Provider balance: 111.11
```

#### 1️⃣4️⃣ **تحديث قاعدة البيانات**
```
💾 Step 13: Updating order in database...
   ✅ Order updated in database
   - Provider ID: <uuid>
   - External Order ID: <external-id>
   - External Status: sent

📋 Step 14: Adding note to order...
   ✅ Note added to order
```

#### ✅ **النجاح**
```
================================================================================
✅ AUTO-DISPATCH SUCCESS!
   Order <uuid> sent to znet
   External Order ID: <external-id>
   Status: sent
================================================================================
```

---

## ❌ رسائل الفشل المحتملة

### لا يوجد PackageRouting
```
⚙️ Step 4: Loading PackageRouting configuration...
   ❌ No PackageRouting configured - SKIPPING
```
**الحل**: أنشئ routing في `/admin/products/package-routing/`

### Mode ليس auto
```
✓ Step 5: Validating routing configuration...
   ⚠️ Routing mode is NOT 'auto' (it's 'manual') - SKIPPING
```
**الحل**: غيّر mode إلى `auto`

### لا يوجد PackageMapping
```
🔗 Step 6: Loading PackageMapping...
   ❌ No PackageMapping found - CANNOT DISPATCH!
```
**الحل**: اربط الباقة مع المزود في Integration → Package Mappings

### لا يوجد Integration
```
🔌 Step 7: Loading Integration details...
   ❌ Integration not found - CANNOT DISPATCH!
```
**الحل**: أنشئ Integration للمزود

### فشل الإرسال للمزود
```
================================================================================
❌ AUTO-DISPATCH FAILED!
   Order: <uuid>
   Error Type: ZnetError
   Error Message: <error-details>
================================================================================

📋 Full traceback:
<traceback-details>
```

---

## 🔎 كيفية استخدام الـ Logs

### 1. أثناء تطوير/اختبار
راقب Terminal أثناء إنشاء طلب:
```bash
# في terminal djangoo
python manage.py runserver
```

ثم في المتصفح أنشئ طلب، ستظهر الرسائل مباشرة!

### 2. تحديد مكان المشكلة
- إذا توقفت الرسائل عند خطوة معينة → المشكلة في تلك الخطوة
- اقرأ الرسالة بعناية لمعرفة السبب

### 3. فحص Payload المرسل
في **Step 9** و **Step 11** تظهر تفاصيل الـ payload المرسل:
```
- Full payload: {
    'productId': '123',
    'qty': 1,
    'orderId': '<uuid>',
    'referans': '<uuid>',
    'userIdentifier': '...',
    'extraField': '...',
    'params': {...}
  }
```

قارن هذا بما يتوقعه المزود الخارجي!

### 4. فحص رد المزود
في **Step 12** يظهر رد المزود الخارجي:
```
- Response: {
    'externalOrderId': '...',
    'status': 'sent',
    'note': 'OK|cost=1.23|balance=111.11',
    'balance': 111.11,
    'cost': 1.23
  }
```

---

## 🐛 سيناريوهات استكشاف الأخطاء

### السيناريو 1: الطلب لا يُرسل تلقائياً
**الأعراض**: لا تظهر رسائل auto-dispatch في Terminal

**الحل**:
1. تحقق أن djangoo server يعمل
2. تحقق أن الطلب يتم إنشاؤه من خلال `/orders/` endpoint

### السيناريو 2: يتوقف عند "Loading PackageRouting"
```
⚙️ Step 4: Loading PackageRouting configuration...
   ❌ No PackageRouting configured - SKIPPING
```

**الحل**: أضف PackageRouting للباقة

### السيناريو 3: "Calling adapter.place_order()" لكن لا يصل للمزود
**الأسباب المحتملة**:
1. بيانات الاتصال خاطئة (kod/sifre/baseUrl)
2. المزود الخارجي متوقف
3. مشكلة في الشبكة/firewall

**التحقق**:
- راجع **Step 7** → تأكد من صحة Integration details
- راجع **Step 11** → انظر للـ error message في traceback

### السيناريو 4: "Provider responded" لكن status=failed
```
   - Status (raw): failed
   - Note: 3|رصيد غير كاف
```

**الحل**: المزود رفض الطلب، راجع سبب الرفض في Note

---

## 📋 Checklist للتحقق السريع

قبل إنشاء طلب، تأكد من:

- [ ] PackageRouting موجود ✓
- [ ] mode = `auto` ✓
- [ ] providerType = `external` ✓
- [ ] PackageMapping موجود ✓
- [ ] Integration موجود ✓
- [ ] بيانات الاتصال صحيحة (kod/sifre) ✓
- [ ] djangoo server يعمل ✓

ثم أنشئ طلب واقرأ الـ logs! 🎯

---

**تم إضافة الـ print statements في**:
- `djangoo/apps/orders/services.py` → `try_auto_dispatch()`
- `djangoo/apps/orders/views.py` → `OrdersCreateView.post()`

**الحالة**: ✅ جاهز للاختبار مع logs مفصلة!
