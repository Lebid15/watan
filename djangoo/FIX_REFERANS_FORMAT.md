# 🔧 إصلاح: استخدام Referans رقمي بدلاً من UUID

## 🐛 المشكلة

المزود znet يرفض الطلبات بخطأ:
```
8|Bağلantı Hatası,Kullanıcı Api Yetki, Kısıtlı Ip yada Kullanıcı Bilgileri Hatalı
```

## 🔍 السبب

### Backend القديم (NestJS):
```typescript
const referans = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
// مثال: "1728577200456"
```

### Backend الجديد (Django) - قبل الإصلاح:
```python
referans = payload.get('orderId')
# مثال: "3687d1d2-a1d2-4604-9035-c4d06b67e8b7"
```

**المشكلة:** المزود قد لا يقبل UUID طويل مع شرطات كـ `referans`!

---

## ✅ الحل

### التعديل في `znet.py`:

```python
# Generate numeric referans like backend does (timestamp + random)
import time
import random
referans = str(int(time.time() * 1000)) + str(random.randint(100, 999))
# مثال: "1728577200456"

# Store original orderId for tracking
original_order_id = payload.get('referans') or payload.get('orderId')

# Send numeric referans to provider
q = {
    'oyun': oyun,
    'kupur': kupur,
    'referans': referans,  # رقم بسيط
    'oyuncu_bilgi': oyuncu_bilgi,
}

# Return original UUID for our database
return {
    'externalOrderId': original_order_id,  # UUID للتتبع في نظامنا
    'providerReferans': referans,  # الرقم الذي أرسلناه للمزود
    'status': status,
    'note': note,
}
```

---

## 🧪 الاختبار

جرّب الآن وسترى:

```
🌐 [ZNET] Final request URL params:
   - oyun: 1
   - kupur: 60
   - oyuncu_bilgi: 9999
   - referans: 1728577200456 (numeric, generated)  ← 🆕 رقم بسيط!
   - original_order_id: 3687d1d2-a1d2-4604-9035-c4d06b67e8b7 (UUID, for tracking)
   
✅ Provider responded!
   - Response: {'status': 'sent', 'note': 'OK|cost=37.60|balance=1234.56'}  ← 🎯 يجب أن ينجح!
```

---

## 📝 الملاحظات

- `referans` المرسل للمزود: **رقم timestamp فقط**
- `externalOrderId` في الـ response: **UUID الأصلي** للتتبع في قاعدة البيانات
- `providerReferans`: **الرقم الذي أرسلناه** (للاستعلام عن الحالة لاحقاً)

**هذا يطابق سلوك الـ backend القديم تماماً!** 🎯
