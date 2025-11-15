# Znet Provider API Documentation

توثيق كامل لـ API الخاص بمزود Znet المستخدم في المشروع.

---

## Base Configuration

```typescript
{
  provider: 'znet',
  baseUrl: string,      // مطلوب (مثل: https://znet-api.example.com)
  kod: string,          // اسم المستخدم - مطلوب
  sifre: string         // كلمة المرور - مطلوب
}
```

## Authentication

يتم التوثيق عبر Query Parameters في كل طلب:
```
kod: YOUR_USERNAME
sifre: YOUR_PASSWORD
```

**ملاحظة هامة:** جميع endpoints تتبع هذا النمط:
```
{baseUrl}/servis/{endpoint}.php?{queryParams}
```

---

## 1. Get Balance (الحصول على الرصيد)

**Endpoint:**
```
GET {baseUrl}/servis/bakiye_kontrol.php?kod={kod}&sifre={sifre}
```

**Response (Text):**
```
OK|43.55
```

**Format:**
```
OK|{balance}
```

**Normalized Response:**
```typescript
{
  balance: number  // الرصيد المتاح
}
```

**Error Response:**
```
ERROR|Invalid credentials
```

---

## 2. List Products (قائمة المنتجات)

**Endpoint:**
```
GET {baseUrl}/servis/pin_listesi.php?kod={kod}&sifre={sifre}
```

**Response (JSON):**
```json
{
  "success": true,
  "result": [
    {
      "id": "12345",
      "adi": "PUBG Mobile 60 UC",
      "fiyat": "45.50",
      "oyun_adi": "PUBG Mobile",
      "oyun_bilgi_id": "100",
      "kupur": "UC60"
    }
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Authentication failed"
}
```

**Normalized Response:**
```typescript
{
  externalId: string;           // id
  name: string;                 // adi أو oyun_adi
  basePrice: number;            // fiyat
  category: string | null;      // oyun_adi
  available: boolean;           // دائماً true
  inputParams: string[];        // ['oyuncu_bilgi', 'musteri_tel']
  quantity: { type: 'none' };
  kind: 'package';
  meta: {
    oyun_bilgi_id?: string;     // معرف اللعبة
    kupur?: string;             // معرف الكوبون
  };
}
```

---

## 3. Place Order (تقديم طلب جديد)

**Endpoint:**
```
GET {baseUrl}/servis/pin_ekle.php?{queryParams}
```

**Query Parameters:**
```
kod: string                    // اسم المستخدم - مطلوب
sifre: string                  // كلمة المرور - مطلوب
oyun: string                   // oyun_bilgi_id - مطلوب
kupur: string                  // معرف الكوبون - مطلوب
referans: string               // رقم مرجعي فريد - مطلوب
oyuncu_bilgi: string           // معرف اللاعب - مطلوب
musteri_tel?: string           // رقم هاتف العميل - اختياري
```

**مثال:**
```
GET {baseUrl}/servis/pin_ekle.php?kod=username&sifre=password&oyun=100&kupur=UC60&referans=1699999999123&oyuncu_bilgi=123456789&musteri_tel=905551234567
```

**Success Response (Text):**
```
OK|45.50|1234.50
```

**Format:**
```
OK|{cost}|{remaining_balance}
```

**Error Response (Text):**
```
8|Bağlantı hatası veya yetersiz bakiye
```

**Format:**
```
{error_code}|{error_message}
```

**Normalized Response:**
```typescript
{
  success: boolean;
  externalOrderId?: string;      // tahsilat_api_islem_id أو referans
  providerStatus?: string;       // 'accepted' أو 'rejected'
  mappedStatus?: 'pending' | 'failed';
  price?: number;                // التكلفة الفعلية
  raw: any;
  costCurrency?: 'TRY';          // الليرة التركية
  note?: string;                 // رسالة توضيحية إن وُجدت
}
```

### Input Parameters Mapping

يدعم المزود عدة أسماء للمعاملات، يتم تحويلها تلقائياً:

| Parameter Names (مقبولة) | Target Parameter |
|--------------------------|------------------|
| oyuncu_bilgi, oyuncuNo, playerId, player, userIdentifier, uid, gameId, user_id, account | `oyuncu_bilgi` |
| musteri_tel, phone, msisdn, tel | `musteri_tel` |
| extra, extraField, ek_bilgi, additional | يُدمج مع oyuncu_bilgi أو يُستخدم كـ musteri_tel |

### ملاحظة خاصة بـ extra

- إذا كان `extra` يشبه رقم هاتف (9-15 رقم مع + اختياري) ولا يوجد `musteri_tel` → يُرسل كـ `musteri_tel`
- إذا كان `extra` لا يشبه رقم هاتف → يُدمج مع `oyuncu_bilgi` بمسافة واحدة

---

## 4. Check Order (التحقق من حالة طلب)

**Endpoint:**
```
GET {baseUrl}/servis/pin_kontrol.php?{queryParams}
```

**Query Parameters:**
```
kod: string                          // اسم المستخدم - مطلوب
sifre: string                        // كلمة المرور - مطلوب
tahsilat_api_islem_id: string        // معرف الطلب - مطلوب
```

**مثال:**
```
GET {baseUrl}/servis/pin_kontrol.php?kod=username&sifre=password&tahsilat_api_islem_id=1699999999123
```

**Response (Text):**
```
OK|{statusCode}|{pin}|{description}
```

### أمثلة على الردود

1. **تم القبول (Pending):**
```
OK|1| - |İşlem bekleniyor
```

2. **نجح (Success):**
```
OK|2|ABC123XYZ789|İşlem tamamlandı
```

3. **فشل (Failed):**
```
OK|3| - |İşlem iptal edildi
```

### Status Code Mapping

| Status Code | Mapped Status | Description |
|------------|---------------|-------------|
| 1 | `pending` | في الانتظار |
| 2 | `success` | تم بنجاح |
| 3 | `failed` | فشل/ألغي |

**Normalized Response:**
```typescript
{
  externalOrderId: string;
  providerStatus: string;        // "1" أو "2" أو "3"
  mappedStatus: 'pending' | 'success' | 'failed';
  note?: string;                 // الوصف من المزود
  pin?: string;                  // كود PIN إن وُجد
  raw: any;
}
```

---

## Error Handling

### Error Patterns

```typescript
// Response HTML (خطأ في الـ baseUrl أو IP مقيّد)
"<!DOCTYPE html>..."

// رمز خطأ مع رسالة
"8|Bağlantı hatası"

// رد فارغ (مشكلة في التوثيق أو IP)
""
```

### Common Issues

- `Empty response` → مشكلة في IP أو التوثيق
- `HTML response` → baseUrl خاطئ أو IP محظور
- `Non-JSON response (pin_listesi)` → مشكلة في التوثيق
- `Missing oyuncu_bilgi` → تأكد من تمرير معلومات اللاعب

---

## Currency Information

- **العملة:** الليرة التركية (TRY)
- **التعامل:** جميع الأسعار والتكاليف بالليرة التركية

---

## Best Practices & Tips

1. **IP Restriction:** تأكد من أن IP السيرفر مسموح لديهم
2. **Response Type:** الردود نصية (text) وليست JSON (إلا pin_listesi)
3. **Referans:** استخدم رقم مرجعي فريد لكل طلب (timestamp + random)
4. **Player Info:** تأكد من تمرير `oyuncu_bilgi` بشكل صحيح
5. **Phone Number:** رقم الهاتف اختياري لكن مفضل إرساله
6. **Extra Field:** يُدمج مع `oyuncu_bilgi` أو يُستخدم كهاتف حسب الشكل

---

## Example Implementation

```typescript
// 1. Initialize Provider
const config = {
  id: 'uuid-456',
  name: 'My Znet Integration',
  provider: 'znet',
  baseUrl: 'https://znet-api.example.com',
  kod: 'username',
  sifre: 'password',
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
    oyuncu_bilgi: '123456789',
    musteri_tel: '905551234567',
    // الـ provider سيستخرج oyun و kupur من الكاش بناءً على productId
  },
});

if (orderResult.success) {
  console.log(`Order placed: ${orderResult.externalOrderId}`);
  console.log(`Status: ${orderResult.mappedStatus}`);
  console.log(`Price: ${orderResult.price} ${orderResult.costCurrency}`);
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
[Znet] pin_ekle -> base=... query={kod: "...", sifre: "***", ...}
[Znet] pin_ekle <- raw="OK|45.50|1234.50"
[Znet] pin_ekle parsed -> {ok: true, cost: 45.50, balance: 1234.50}
[Znet] pin_kontrol -> base=... query={...}
[Znet] pin_kontrol <- raw="OK|2|ABC123|İşlem tamamlandı"
```

---

## Rate Limiting & Quotas

- لا توجد معلومات محددة عن rate limiting
- يُنصح بالانتظار بين الطلبات (100-500ms)
- تجنب الطلبات المتوازية الكثيفة

---

## Contact & Support

- يُطلب معلومات الاتصال من المزود مباشرة
- تأكد من إضافة IP السيرفر في القائمة البيضاء

---

## Advanced Features

### Fetch Catalog for Import

```typescript
// استخدام fetchCatalog للحصول على كتالوج موحد
const catalog = await provider.fetchCatalog(config);

// كل عنصر يحتوي على:
catalog.forEach(item => {
  console.log({
    productExternalId: item.productExternalId,    // oyun_bilgi_id
    productName: item.productName,                // اسم اللعبة
    packageExternalId: item.packageExternalId,    // id الكوبون
    packageName: item.packageName,                // اسم الباقة
    costPrice: item.costPrice,                    // السعر
    currencyCode: item.currencyCode,              // TRY
  });
});
```

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-15 | 1.0 | Initial documentation - تم فصل توثيق Znet |

---

**ملاحظة:** هذا التوثيق مبني على الكود الموجود في:
- `backend/src/integrations/providers/znet.provider.ts`
- `backend/src/integrations/providers/znet.client.ts`
- `backend/src/integrations/providers/znet.parser.ts`
- `backend/src/integrations/types.ts`
