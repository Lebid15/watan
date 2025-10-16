# ✅ إصلاح مشكلة ظهور الملاحظات من المزود الداخلي

**التاريخ:** 16 أكتوبر 2025  
**المشكلة:** الملاحظات التي يكتبها المزود الداخلي (شام تيك) لا تظهر عند المستخدم النهائي (خليل) والمستأجر (الشام)

---

## 📋 وصف المشكلة

### السيناريو:
1. **خليل** (مستخدم) يرسل طلب
2. الطلب يذهب إلى **الشام** (مستأجر)
3. **الشام** يوجه الطلب إلى **شام تيك** (مزود داخلي) عبر **ديانا** (حساب وسيط)
4. **شام تيك** يقبل/يرفض الطلب ويكتب ملاحظة مثل "Order placed successfully"

### المشكلة:
- ✅ الملاحظة تظهر عند **شام تيك**
- ✅ الملاحظة تظهر عند **ديانا**
- ❌ الملاحظة **لا تظهر** عند **الشام**
- ❌ الملاحظة **لا تظهر** عند **خليل**

---

## 🔧 الحل المطبق

### 1. تحديث Django Tasks (`djangoo/apps/orders/tasks.py`)

**قبل:**
```python
if message:
    # كان يحفظ الرسالة في lastMessage فقط
    update_fields.append('"lastMessage" = %s')
    update_values.append(message[:250])
```

**بعد:**
```python
if message:
    new_message = (order.last_message or '') + f" | {message}"
    update_fields.append('"lastMessage" = %s')
    update_values.append(new_message[:250])
    
    # ✅ تحديث manual_note بملاحظة المزود (ستظهر للجميع)
    update_fields.append('"manualNote" = %s')
    update_values.append(message[:500])
    
    update_fields.append('"providerMessage" = %s')
    update_values.append(message[:250])
```

### 2. تحديث Webhook Payload (`backend/src/client-api/client-api-webhook.enqueue.service.ts`)

**قبل:**
```typescript
const payload = {
  event: 'order-status',
  order_id: opts.order.id,
  status: this.mapStatus(opts.order.status),
  // ... بدون note
};
```

**بعد:**
```typescript
const payload = {
  event: 'order-status',
  order_id: opts.order.id,
  status: this.mapStatus(opts.order.status),
  note: opts.order.manualNote || null,  // ✅ إضافة الملاحظة
  // ...
};
```

### 3. تمرير manualNote في Webhook (`backend/src/products/products.service.ts`)

**قبل:**
```typescript
await this.clientApiWebhookEnqueue.enqueueOrderStatus({
  order: {
    id: saved.id,
    status: saved.status,
    // ... بدون manualNote
  },
});
```

**بعد:**
```typescript
await this.clientApiWebhookEnqueue.enqueueOrderStatus({
  order: {
    id: saved.id,
    status: saved.status,
    manualNote: (saved as any).manualNote || null,  // ✅ تمرير الملاحظة
  },
});
```

---

## 🎯 كيف يعمل الآن

### التسلسل الصحيح:

1. **شام تيك** يقبل/يرفض الطلب ويكتب ملاحظة "Order placed successfully"
2. الملاحظة تُحفظ في `manualNote` للطلب في tenant شام تيك ✅
3. **Django Sync Task** يستعلم عن حالة الطلب من API شام تيك
4. الرد يحتوي على `note: "Order placed successfully"`
5. **Django يحدث الطلب الأصلي** (في tenant الشام) بـ:
   - `manualNote = "Order placed successfully"` ✅
   - `providerMessage = "Order placed successfully"` ✅
   - `lastMessage` يتم إضافة الرسالة إليه ✅
6. **Backend NestJS** يرسل webhook للطلب الأصلي مع `note`
7. **النتيجة:** الملاحظة تظهر في:
   - ✅ تفاصيل الطلب عند خليل (`manualNote`)
   - ✅ تفاصيل الطلب عند الشام (`manualNote`)
   - ✅ قائمة الطلبات (`manualNote` موجود في response)

---

## 📊 الملفات المعدلة

1. ✅ `djangoo/apps/orders/tasks.py` - تحديث manualNote عند sync
2. ✅ `backend/src/client-api/client-api-webhook.enqueue.service.ts` - إضافة note للـ payload
3. ✅ `backend/src/products/products.service.ts` - تمرير manualNote للـ webhook

---

## ✅ اختبار الحل

### الخطوات:
1. قم بإعادة تشغيل Django و Backend
2. اطلب من خليل إنشاء طلب جديد
3. قم بتوجيه الطلب إلى شام تيك
4. من حساب شام تيك، قبل/ارفض الطلب مع كتابة ملاحظة
5. انتظر حتى يتم sync الطلب (أو قم بتشغيل sync يدوياً)
6. تحقق من تفاصيل الطلب عند:
   - ✅ خليل - يجب أن يرى الملاحظة
   - ✅ الشام - يجب أن يرى الملاحظة
   - ✅ شام تيك - يجب أن يرى الملاحظة

---

## 🔍 التحقق من البيانات

### في قاعدة البيانات:
```sql
-- تحقق من الطلب الأصلي
SELECT id, status, "manualNote", "providerMessage", "lastMessage"
FROM product_orders
WHERE id = 'ORDER_ID';
```

يجب أن يظهر:
- `manualNote`: "Order placed successfully" ✅
- `providerMessage`: "Order placed successfully" ✅
- `lastMessage`: يحتوي على الرسالة ✅

### في API Response:
```json
{
  "id": "...",
  "status": "approved",
  "manualNote": "Order placed successfully",  // ✅ موجود
  "providerMessage": "Order placed successfully"
}
```

---

## ⚠️ ملاحظات مهمة

1. **Sync مطلوب:** التحديث يحدث عند sync الطلب من المزود الداخلي
2. **Webhook:** إذا كان webhook مفعل، سيتم إرسال الملاحظة أيضاً
3. **التوافق السابق:** الطلبات القديمة ستبقى كما هي، التحديث يؤثر على الطلبات الجديدة فقط

---

**الحالة:** ✅ تم الحل  
**التأثير:** جميع المستخدمين سيرون ملاحظات المزود الداخلي

**آخر تحديث:** 16 أكتوبر 2025
