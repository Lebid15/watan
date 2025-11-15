# Barakat / Apstore Provider API Documentation

توثيق كامل لـ API الخاص بمزود Barakat/Apstore المستخدم في المشروع.

---

## Base Configuration

```typescript
{
  provider: 'barakat' | 'apstore',
  baseUrl?: string,      // الافتراضي: https://api.x-stor.net
  apiToken: string       // مطلوب
}
```

## Authentication

يتم التوثيق عبر Header:
```
api-token: YOUR_API_TOKEN
```

---

## 1. Get Balance (الحصول على الرصيد)

**Endpoint:**
```
GET {baseUrl}/client/api/profile
```

**Headers:**
```
api-token: YOUR_API_TOKEN
```

**Response:**
```json
{
  "balance": "43.55",
  "email": "user@example.com"
}
```

**Normalized Response:**
```typescript
{
  balance: number  // رقم الرصيد المتاح
}
```

---

## 2. List Products (قائمة المنتجات)

**Endpoint:**
```
GET {baseUrl}/client/api/products
```

**Headers:**
```
api-token: YOUR_API_TOKEN
```

**Response:**
```json
[
  {
    "id": "12345",
    "name": "PUBG Mobile 60 UC",
    "price": "45.50",
    "category_name": "PUBG Mobile",
    "available": true,
    "params": ["uid", "server"],
    "product_type": "package",
    "qty_values": null  // أو { "min": 1, "max": 100 } أو ["10", "20", "50"]
  }
]
```

**Normalized Response:**
```typescript
{
  externalId: string;           // معرف المنتج الخارجي
  name: string;                 // اسم المنتج
  basePrice: number;            // السعر الأساسي
  category: string | null;      // الفئة
  available: boolean;           // متاح/غير متاح
  inputParams: string[];        // المعاملات المطلوبة
  quantity: {
    type: 'none' | 'range' | 'set';
    min?: number;               // للنوع range
    max?: number;               // للنوع range
    values?: number[];          // للنوع set
  };
  kind: 'package' | 'amount' | 'specificPackage';
}
```

---

## 3. Place Order (تقديم طلب جديد)

**Endpoint:**
```
GET {baseUrl}/client/api/newOrder/{productId}/params?{queryParams}
```

**Query Parameters:**
```
qty: number                    // الكمية
{param1}: string               // معاملات المنتج (مثل uid, server)
{param2}: string
order_uuid?: string            // UUID اختياري للطلب من جانب العميل
```

**مثال:**
```
GET {baseUrl}/client/api/newOrder/12345/params?qty=1&uid=123456789&server=asia&order_uuid=uuid-123
```

**Headers:**
```
api-token: YOUR_API_TOKEN
```

**Success Response:**
```json
{
  "status": "OK",
  "data": {
    "order_id": "67890",
    "status": "success",
    "price": "45.50",
    "pin": "ABC123XYZ789",           // اختياري - كود PIN
    "replay_api": ["Order completed successfully"],
    "note": "تم إتمام الطلب بنجاح"
  }
}
```

**Error Response:**
```json
{
  "status": "ERROR",
  "message": "Insufficient balance",
  "error": "نقص في الرصيد"
}
```

**Normalized Response:**
```typescript
{
  success: boolean;
  externalOrderId?: string;      // معرف الطلب من المزود
  providerStatus?: string;       // الحالة من المزود
  mappedStatus?: 'pending' | 'success' | 'failed';
  price?: number;                // السعر الفعلي
  raw: any;                      // البيانات الخام
  costCurrency?: 'TRY';          // العملة (الليرة التركية)
  note?: string;                 // ملاحظة توضيحية
  pin?: string;                  // كود PIN إن وُجد
}
```

---

## 4. Check Orders (التحقق من حالة الطلبات)

**Endpoint:**
```
GET {baseUrl}/client/api/check?orders={orderIds}
```

**Query Parameters:**
```
orders: string   // JSON array محول لـ URL encoded مثل: [123,456,789]
```

**مثال:**
```
GET {baseUrl}/client/api/check?orders=%5B67890%2C67891%5D
```

**Headers:**
```
api-token: YOUR_API_TOKEN
```

**Response:**
```json
{
  "status": "OK",
  "data": [
    {
      "order_id": "67890",
      "status": "success",
      "price": "45.50",
      "pin": "ABC123XYZ789",
      "note": "Order completed"
    },
    {
      "order_id": "67891",
      "status": "pending",
      "note": "Processing..."
    }
  ]
}
```

**Normalized Response:**
```typescript
Array<{
  externalOrderId: string;
  providerStatus: string;
  mappedStatus: 'pending' | 'success' | 'failed';
  raw: any;
  note?: string;
  pin?: string;
  costCurrency: 'TRY';
}>
```

---

## Status Mapping

يتم تحويل الحالات من المزود إلى حالات موحدة:

| Provider Status | Mapped Status |
|----------------|---------------|
| success, ok, done, complete, completed | `success` |
| reject, rejected, failed, fail, error, cancelled, canceled | `failed` |
| wait, pending, processing, inprogress, queued, queue, accepted | `pending` |

---

## Error Handling

### Error Patterns

```typescript
// يُعتبر فشل حقيقي (Hard Failure) إذا:
const errorKeywords = [
  'insufficient balance',
  'bakiye',
  'balance',
  'not enough',
  'unauthorized',
  'invalid token',
  'missing',
  'hata',
  'error',
  'fail',
  'rejected'
];

// أو إذا كان status في المستوى العلوي != "OK"
```

### Common Issues

- `Invalid balance response` → تحقق من apiToken
- `HTML response` → baseUrl خاطئ
- `Timeout` → زد قيمة timeout

---

## Currency Information

- **العملة:** الليرة التركية (TRY)
- **التعامل:** جميع الأسعار والتكاليف بالليرة التركية

---

## Best Practices & Tips

1. **Authentication:** احفظ `apiToken` بشكل آمن
2. **Timeouts:** استخدم timeout مناسب (15-30 ثانية)
3. **Status Mapping:** اعتمد على `status` في المستوى العلوي أولاً
4. **PIN Extraction:** ابحث عن PIN في `data.pin` أو `data.code`
5. **Note Extraction:** ابحث في `replay_api` أو `note` أو `message`

---

## Example Implementation

```typescript
// 1. Initialize Provider
const config = {
  id: 'uuid-123',
  name: 'My Barakat Integration',
  provider: 'barakat',
  baseUrl: 'https://api.x-stor.net',
  apiToken: 'your-token-here',
};

// 2. Check Balance
const { balance } = await provider.getBalance(config);
console.log(`Available balance: ${balance}`);

// 3. List Products
const products = await provider.listProducts(config);
console.log(`Found ${products.length} products`);

// 4. Place Order
const orderResult = await provider.placeOrder(config, {
  productId: '12345',
  qty: 1,
  params: {
    uid: '123456789',
    server: 'asia',
  },
  clientOrderUuid: 'my-order-uuid-123',
});

if (orderResult.success) {
  console.log(`Order placed: ${orderResult.externalOrderId}`);
  console.log(`Status: ${orderResult.mappedStatus}`);
  console.log(`Price: ${orderResult.price} ${orderResult.costCurrency}`);
  if (orderResult.pin) {
    console.log(`PIN: ${orderResult.pin}`);
  }
} else {
  console.error(`Order failed: ${orderResult.note}`);
}

// 5. Check Order Status
const statuses = await provider.checkOrders(config, [
  orderResult.externalOrderId!,
]);

for (const status of statuses) {
  console.log(`Order ${status.externalOrderId}: ${status.mappedStatus}`);
  if (status.pin) {
    console.log(`PIN: ${status.pin}`);
  }
  if (status.note) {
    console.log(`Note: ${status.note}`);
  }
}
```

---

## Debug Logging

الكود يحتوي على logging مفصّل:

```typescript
[Barakat] getBalance duration=500ms
[Barakat] listProducts fetched count=150 duration=1200ms
[Barakat] newOrder <- raw="..."
[Barakat] newOrder parsed -> {...}
[Barakat] check <- raw="..."
```

---

## Rate Limiting & Quotas

- لا توجد معلومات محددة عن rate limiting
- يُنصح بعدم إرسال أكثر من 10 طلبات/ثانية

---

## Contact & Support

- **Website:** https://x-stor.net
- **API Docs:** يُطلب من فريق الدعم

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-15 | 1.0 | Initial documentation - تم فصل توثيق Barakat |

---

**ملاحظة:** هذا التوثيق مبني على الكود الموجود في:
- `backend/src/integrations/providers/barakat.provider.ts`
- `backend/src/integrations/types.ts`
