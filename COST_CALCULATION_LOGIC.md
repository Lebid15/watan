# 💰 منطق حساب التكلفة (Cost Calculation Logic)

## 📋 ملخص

تم تصليح منطق حساب تكلفة الطلبات ليتناسب مع **ثلاث حالات** مختلفة حسب نوع تنفيذ الطلب.

---

## 🎯 الحالات الثلاثة

### ✅ الحالة 1: مزود خارجي (External Provider)

**الشرط:**
```python
if order.provider_id and order.external_order_id:
```

**المنطق:**
1. الطلب تم إرساله لمزود خارجي (مثل znet, barakat, apstore)
2. **الأولوية الأولى**: البحث في جدول `package_costs` عن التكلفة المحددة لهذا المزود
3. **Fallback**: إذا لم يوجد `PackageCost`، استخدم `package.base_price`

**مثال:**
- طلب PUBG تم إرساله لـ znet
- نبحث عن `PackageCost` حيث:
  - `tenant_id` = tenant الحالي
  - `package_id` = باقة PUBG
  - `provider_id` = znet
- إذا وجدنا السجل، نأخذ `cost_amount` (مثلاً $0.85)
- هذه هي **التكلفة الفعلية** التي ستدفعها للمزود

**الكود:**
```python
package_cost = PackageCost.objects.get(
    tenant_id=tenant_id,
    package_id=order.package_id,
    provider_id=order.provider_id
)
base_usd = package_cost.cost_amount
```

---

### ✅ الحالة 2: تنفيذ داخلي (Internal/Manual Execution)

**الشرط:**
```python
elif order.status == 'approved' and not order.provider_id:
```

**المنطق:**
1. الطلب تم تنفيذه داخلياً (manual execution)
2. لم يتم إرساله لأي مزود خارجي
3. **التكلفة = $0** (لأنك تنفذه بنفسك)

**مثال:**
- المستأجر نفّذ الطلب يدوياً (manual)
- لا يوجد `provider_id`
- التكلفة = $0
- كل المبلغ = ربح صافي

**الكود:**
```python
base_usd = Decimal('0')  # التكلفة = 0 للتنفيذ الداخلي
```

---

### ✅ الحالة 3: pending أو من مجموعة الأسعار (Price Group)

**الشرط:**
```python
else:  # الطلب pending أو لم يُرسل بعد
```

**المنطق:**
1. الطلب لم يتم تنفيذه بعد (status = pending)
2. أو الطلب في حالة انتظار
3. نأخذ التكلفة **التقديرية** من `package.base_price`
4. هذه القيمة من `price_group` المرتبط بالمستخدم

**مثال:**
- طلب جديد تم إنشاؤه
- لم يتم إرساله للمزود بعد
- نعرض التكلفة التقديرية من `package.base_price`
- عند الإرسال للمزود، ستتحدث التكلفة للقيمة الفعلية (الحالة 1)

**الكود:**
```python
pkg = ProductPackage.objects.get(id=order.package_id)
base_usd = Decimal(str(pkg.base_price or pkg.capital or 0))
```

---

## 🔍 مثال عملي

### سيناريو: طلب PUBG 60 UC

#### 📝 المعلومات:
- الباقة: PUBG 60 UC
- `package.base_price` = $0.90 (من price_group)
- `PackageCost` لـ znet = $0.85 (التكلفة الفعلية)
- سعر البيع: $1.20

#### 🔄 مراحل الطلب:

**1️⃣ عند الإنشاء (pending):**
```
Status: pending
Provider: null
Cost: $0.90 (من base_price)
Profit: $1.20 - $0.90 = $0.30
```

**2️⃣ بعد الإرسال لـ znet:**
```
Status: pending → processing
Provider: znet
External Order ID: 123456
Cost: $0.85 (من PackageCost)
Profit: $1.20 - $0.85 = $0.35 ✅
```

**3️⃣ لو كان التنفيذ يدوي:**
```
Status: approved
Provider: null (manual)
External Order ID: null
Cost: $0.00 (تنفيذ داخلي)
Profit: $1.20 - $0.00 = $1.20 💰
```

---

## 📊 جدول المقارنة

| الحالة | الشرط | مصدر التكلفة | القيمة | ملاحظات |
|--------|-------|--------------|--------|----------|
| **مزود خارجي** | `provider_id && external_order_id` | `PackageCost.cost_amount` | $0.85 | تكلفة فعلية |
| **تنفيذ داخلي** | `status=approved && !provider_id` | ثابتة | $0.00 | لا توجد تكلفة |
| **pending/قيد الانتظار** | `else` | `package.base_price` | $0.90 | تكلفة تقديرية |

---

## 🛠️ الملفات المعدّلة

### 1. `djangoo/apps/orders/services.py`
- **الدالة**: `freeze_fx_on_approval()`
- **التغيير**: إضافة منطق if-elif-else لتحديد مصدر التكلفة
- **السطر**: ~390-445

---

## ✅ الفوائد

1. ✅ **دقة أعلى**: التكلفة الفعلية من المزود الخارجي
2. ✅ **شفافية**: التكلفة = $0 للتنفيذ الداخلي
3. ✅ **تقدير صحيح**: للطلبات pending من price_group
4. ✅ **أرباح صحيحة**: الربح يُحسب بناءً على التكلفة الفعلية

---

## 🎯 ما التالي؟

### اختبار النظام:
1. ✅ إنشاء طلب جديد (pending) - شوف التكلفة التقديرية
2. ✅ إرسال الطلب لمزود خارجي - شوف التكلفة الفعلية
3. ✅ تنفيذ طلب يدوياً - شوف التكلفة = $0
4. ✅ تحقق من الأرباح في كل حالة

### ملاحظات للمستقبل:
- 📝 تأكد من وجود `PackageCost` لكل باقة مع كل مزود
- 📝 راقب الحالات التي تستخدم fallback (base_price)
- 📝 يمكن إضافة تنبيه إذا PackageCost غير موجود

---

✅ **تم التطبيق بنجاح!** 🎉
