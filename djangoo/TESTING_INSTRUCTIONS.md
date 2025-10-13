# 🧪 تعليمات الاختبار - التوجيه التلقائي

## ⚠️ ملاحظة مهمة جداً

الكود الذي أضفناه يعمل فقط عند **إنشاء طلبات جديدة من واجهة المستخدم النهائي**!

**الطلبات الموجودة حالياً** في `/admin/orders/` ربما تم إنشاؤها من:
1. Backend القديم (NestJS) - قبل التحديث
2. قبل إضافة كود auto-dispatch

❌ **خطأ شائع**: النظر إلى طلبات قديمة وتوقع أن تُرسل تلقائياً!

---

## ✅ خطوات الاختبار الصحيحة

### 1️⃣ تأكد أن djangoo server يعمل
```bash
cd f:\watan\djangoo
python manage.py runserver
```

### 2️⃣ افتح Terminal وراقب الـ logs
احتفظ بنافذة Terminal مرئية لترى رسائل auto-dispatch

### 3️⃣ **سجّل دخول كمستخدم عادي** (ليس أدمن!)
- اذهب إلى: `http://alsham.localhost:3000/`
- سجّل دخول بحساب مستخدم عادي

### 4️⃣ اختر منتج PUBG Global 60
- اذهب إلى صفحة المنتجات
- اختر باقة PUBG Global 60
- املأ البيانات المطلوبة (User ID, etc.)

### 5️⃣ أرسل الطلب
**اضغط على زر "شحن" أو "إنشاء طلب"**

### 6️⃣ راقب Terminal فوراً!
يجب أن ترى رسائل مثل:

```
================================================================================
🚀 AUTO-DISPATCH START: Order ID = abc-123...
================================================================================

📦 Step 1: Fetching order...
   ✅ Order found: abc-123...

🔄 Attempting auto-dispatch for order: abc-123...

⚙️ Step 4: Loading PackageRouting configuration...
   ✅ PackageRouting found!
   - Mode: auto
   - Provider Type: external

... (باقي الرسائل)

🚀 Step 11: SENDING ORDER TO PROVIDER...
   📡 Calling adapter.place_order()...
   ✅ Provider responded!

✅ AUTO-DISPATCH SUCCESS!
```

### 7️⃣ تحقق من الطلب في `/admin/orders/`
- سجّل دخول كأدمن
- اذهب إلى `/admin/orders/`
- ابحث عن **آخر طلب** (الأحدث)
- يجب أن تجد:
  - ✅ Provider ID: محدد (znet UUID)
  - ✅ External Order ID: محدد
  - ✅ Status: sent أو processing
  - ✅ API: znet (وليس manual)

---

## 🔍 ماذا لو لم تظهر رسائل auto-dispatch؟

### السبب 1: الطلب لم يُنشأ من djangoo
**الحل**: تأكد أنك تنشئ الطلب من واجهة المستخدم النهائي (وليس من لوحة الأدمن)

### السبب 2: الطلب يُنشأ من backend القديم
**الحل**: تأكد أن Frontend يستخدم `/api-dj/orders` وليس `/api/orders` القديم

**كيف تتحقق؟**
افتح Developer Tools في المتصفح → Network tab → أرسل طلب → ابحث عن request:
- ✅ يجب أن ترى: `POST /api-dj/orders`
- ❌ إذا رأيت: `POST /api/orders` فهذا يذهب للـ backend القديم!

### السبب 3: خطأ في الكود
ارجع للـ Terminal وابحث عن أخطاء Python/Django

---

## 📋 Checklist قبل الاختبار

قبل إنشاء طلب جديد، تأكد من:

### في قاعدة البيانات
- [ ] `package_routing` موجود للباقة
  - mode = 'auto'
  - providerType = 'external'
  - primaryProviderId = <znet-integration-uuid>

- [ ] `package_mapping` موجود
  - our_package_id = <pubg-60-package-id>
  - provider_api_id = <znet-integration-uuid>
  - provider_package_id = <znet-external-id>

- [ ] `integrations` موجود
  - provider = 'znet'
  - kod و sifre محددان
  - base_url محدد

### في الكود
- [ ] djangoo server يعمل
- [ ] لا توجد أخطاء syntax في services.py
- [ ] Terminal مرئي لرؤية الـ logs

### في Frontend
- [ ] الطلب يُرسل إلى `/api-dj/orders` (وليس `/api/orders`)

---

## 🎯 سيناريو اختبار كامل

```bash
# 1. شغّل djangoo
cd f:\watan\djangoo
python manage.py runserver

# 2. في متصفح جديد:
# - افتح http://alsham.localhost:3000/
# - سجّل دخول كمستخدم عادي
# - اذهب لصفحة PUBG Global 60
# - املأ البيانات
# - اضغط "شحن"

# 3. راقب Terminal فوراً!
# يجب أن ترى:
# 🚀 AUTO-DISPATCH START: Order ID = ...
# 📦 Step 1: Fetching order...
# ...
# ✅ AUTO-DISPATCH SUCCESS!

# 4. تحقق من الطلب:
# - سجّل دخول كأدمن
# - افتح /admin/orders/
# - ابحث عن آخر طلب
# - تأكد من وجود Provider ID و External Order ID
```

---

## 🐛 إذا لم يعمل

### 1. لم تظهر أي رسائل auto-dispatch
→ الطلب لم يُنشأ من djangoo، تحقق من Frontend

### 2. ظهرت رسائل لكن توقفت عند "No PackageRouting"
→ أضف PackageRouting في `/admin/products/package-routing/`

### 3. ظهرت رسائل لكن "No PackageMapping found"
→ اربط الباقة مع المزود في Integration → Package Mappings

### 4. وصلت لـ "SENDING ORDER TO PROVIDER" لكن فشل
→ راجع error message في traceback
→ تحقق من صحة بيانات znet (kod/sifre/baseUrl)

---

## 📸 لقطات شاشة مطلوبة للتحقق

1. **Terminal** أثناء إنشاء الطلب (يجب أن يظهر auto-dispatch logs)
2. **Network tab** في DevTools (يجب POST `/api-dj/orders`)
3. **Order details** في `/admin/orders/` (يجب أن يظهر Provider ID)

---

**✅ الآن جرّب إنشاء طلب جديد وأخبرني بالنتيجة!**
