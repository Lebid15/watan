# Tenant External API (Phase 4)

واجهة مخصّصة للوصول الخارجي المرتبط بمستخدم واحد داخل المتجر (Tenant User). تعتمد على توكنات بصلاحيات (Scopes) وتدعم Idempotency في إنشاء الطلبات.

> Feature Flag: externalApi=true

## المصادقة
- الرأٍس: `Authorization: Bearer <prefix>.<secret>`
- التوكن يُعرض (بالنص الكامل) مرة واحدة عند الإنشاء. يُخزَّن الجزء السري كـ hash فقط.

## الرؤوس الهامة
- `Idempotency-Key`: مطلوب في POST /orders لضمان عدم التكرار.
- معدل الطلبات: 60 طلب / دقيقة لكل توكن.
### الرؤوس العائدة (Response Headers)
- `X-RateLimit-Limit`: الحد الأقصى (حالياً 60)
- `X-RateLimit-Remaining`: المتبقي ضمن نافذة الدقيقة
- `X-RateLimit-Reset`: طابع زمني (ثواني يونكس) لانتهاء النافذة
- `X-Idempotency-Cache: HIT` عند إعادة تنفيذ نفس الطلب (جسم مطابق) ليعود 200 بدل 201

## الصلاحيات (Scopes)
- `ping`
- `wallet.balance`
- `catalog.read`
- `orders.create`
- `orders.read`

## المسارات
### GET /api/tenant/external/v1/ping
Scope: `ping`
يرجع `{ ok: true, time, tenantId, userId }`

### GET /api/tenant/external/v1/wallet/balance
Scope: `wallet.balance`
يرجع رصيد المستخدم المرتبط بالتوكن.

### GET /api/tenant/external/v1/catalog/products
Scope: `catalog.read`
قائمة المنتجات/الباقات المتاحة (linkCode + أسماء مختصرة).

### POST /api/tenant/external/v1/orders
Scope: `orders.create`
Headers: `Idempotency-Key: <unique-key>` (مطلوب)
Body:
```
{ "linkCode": "pkg_123", "quantity": 2, "userIdentifier": "player77" }
```
سلوك Idempotency:
| الحالة | الوصف |
|--------|-------|
| أول طلب بالمفتاح | 201 Created — ينشئ سجلًا ويعالج الطلب |
| طلب ثانٍ بنفس المفتاح ونفس الجسم | 200 OK نفس `{ orderId, ... }` + `X-Idempotency-Cache: HIT` |
| طلب بنفس المفتاح وجسم مختلف | 409 `IDEMPOTENCY_MISMATCH` |
| طلب جديد بينما السجل بلا orderId بعد | 409 `IDEMPOTENCY_IN_PROGRESS` |

مثال (أول إنشاء 201):
```json
{
     "orderId": "9d8c...",
     "status": "pending",
     "createdAt": "2025-08-27T12:00:00.000Z"
}
```

مثال (تكرار 200 مع Cache HIT):
```
HTTP/1.1 200 OK
X-Idempotency-Cache: HIT
...
{
     "orderId": "9d8c...",
     "status": "pending",
     "createdAt": "2025-08-27T12:00:00.000Z"
}
```

### GET /api/tenant/external/v1/orders/:id
Scope: `orders.read`
يعيد معلومات الطلب إن كان يتبع نفس المستخدم.

## الأخطاء القياسية (رسالة JSON)
| الحالة | code | الوصف |
|--------|------|-------|
| 401 | INVALID_TOKEN | توكن غير صالح/منتهي |
| 403 | FORBIDDEN / MISSING_SCOPE | نقص صلاحية أو منع وصول |
| 409 | IDEMPOTENCY_MISMATCH / IDEMPOTENCY_IN_PROGRESS | تعارض أو قيد التنفيذ |
| 422 | VALIDATION_ERROR | فشل تحقق المدخلات |
| 429 | RATE_LIMITED | تجاوز الحد |

### شكل الغلاف القياسي (Error Envelope)
كل الأخطاء ترجع نفس الهيكل:
```json
{
     "statusCode": 409,
     "code": "IDEMPOTENCY_MISMATCH",
     "message": "IDEMPOTENCY_MISMATCH",
     "timestamp": "2025-08-27T12:00:02.345Z",
     "path": "/api/tenant/external/v1/orders"
}
```

## أمثلة cURL
```bash
# Ping
curl -H "Authorization: Bearer ab12.XYZSECRET" \
     https://api.example.com/api/tenant/external/v1/ping

# إنشاء طلب Idempotent
curl -H "Authorization: Bearer ab12.XYZSECRET" \
     -H "Idempotency-Key: order-001" \
     -H "Content-Type: application/json" \
     -d '{"linkCode":"pkg_1","quantity":1}' \
     https://api.example.com/api/tenant/external/v1/orders

# تكرار نفس الطلب (نفس orderId)
curl -H "Authorization: Bearer ab12.XYZSECRET" \
     -H "Idempotency-Key: order-001" \
     -H "Content-Type: application/json" \
     -d '{"linkCode":"pkg_1","quantity":1}' \
     https://api.example.com/api/tenant/external/v1/orders -i
```

## ملاحظات
- لا يسمح بأي تعديل للتسعير أو الإعدادات عبر هذه الواجهة.
- يمكن للمالك إدارة التوكنات عبر: `/api/tenant/users/:id/api-tokens`.
 - 201 عند الإنشاء الأول، 200 عند التكرار المطابق.
 - يفضل استخدام UUID أو قيمة hash فريدة لكل `Idempotency-Key`.
