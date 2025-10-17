# إضافة دعم الدين (Debt) لمزود ZNET

## 📋 نظرة عامة
تم إضافة دعم كامل لعرض الدين (debt) لمزود ZNET في صفحة جرد رأس المال.

## 🎯 المشكلة
- مزود ZNET لديه نظام محاسبي مختلف عن المزودين الآخرين
- المزودون العاديون: رصيد واحد يمكن أن يكون موجب أو سالب
- مزود ZNET: قسمان منفصلان (الرصيد + الدين)

## ✅ الحل المطبق

### 1. قاعدة البيانات
**ملف:** `djangoo/ADD_DEBT_TO_INTEGRATIONS.sql`

```sql
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS debt DECIMAL(18, 3) DEFAULT 0;

ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS debt_updated_at TIMESTAMP;
```

**لتطبيق التغيير:**
```bash
# قم بتشغيل SQL مباشرة في قاعدة البيانات
psql -U your_user -d your_database -f djangoo/ADD_DEBT_TO_INTEGRATIONS.sql
```

### 2. Django Model
**ملف:** `djangoo/apps/providers/models.py`

```python
class Integration(models.Model):
    # ... الحقول الموجودة
    balance = models.DecimalField(max_digits=18, decimal_places=3, null=True)
    balance_updated_at = models.DateTimeField(null=True, db_column='balanceUpdatedAt')
    
    # الحقول الجديدة
    debt = models.DecimalField(max_digits=18, decimal_places=3, null=True, default=0)
    debt_updated_at = models.DateTimeField(null=True, db_column='debtUpdatedAt')
```

### 3. Backend API
**ملف:** `djangoo/apps/reports/views.py`

**التغييرات:**
- إضافة جلب حقل `debt` من قاعدة البيانات
- حساب المحصلة (net_amount = balance - debt)
- إرسال البيانات الجديدة للـ frontend:
  - `balance`: الرصيد
  - `debt`: الدين
  - `netBalance`: المحصلة
  - `debtUpdatedAt`: تاريخ آخر تحديث للدين

**الحساب:**
```python
net_amount = balance - debt
usd_amount = convert_to_usd(net_amount, currency)  # يتم حساب USD على المحصلة
```

### 4. Frontend TypeScript Types
**ملف:** `frontend/src/app/admin/reports/capital/page.tsx`

```typescript
type ProviderItem = {
  // ... الحقول الموجودة
  balance: number;
  
  // الحقول الجديدة
  debt?: number;
  netBalance?: number;
  debtUpdatedAt?: string | null;
};
```

### 5. Frontend UI
**ملف:** `frontend/src/app/admin/reports/capital/page.tsx`

**العرض الخاص لـ ZNET:**
```
┌────────────────────────────┐
│ 948.80 ₺ / 500.00 ₺        │ ← الرصيد / الدين (رمادي)
│ ────────────────           │
│ المحصلة: 448.80 ₺          │ ← الرصيد - الدين
└────────────────────────────┘
```

**الكود:**
```tsx
if (isZnet && item.debt > 0) {
  // عرض: الرصيد / الدين
  // عرض: المحصلة = الرصيد - الدين
}
```

## 📊 مثال على البيانات

### Request من Frontend
```
GET /admin/reports/capital
```

### Response من Backend
```json
{
  "providers": {
    "items": [
      {
        "id": "123",
        "name": "alaya",
        "provider": "znet",
        "balance": 948.80,
        "debt": 500.00,
        "netBalance": 448.80,
        "currency": "TRY",
        "balanceUsd": 13.14,
        "balanceUpdatedAt": "2025-10-16T17:09:32",
        "debtUpdatedAt": "2025-10-16T17:09:32"
      }
    ]
  }
}
```

## 🔧 خطوات التطبيق

### 1. تطبيق SQL Migration
```bash
cd f:\watan
# قم بتشغيل SQL في قاعدة البيانات الخاصة بك
```

### 2. إعادة تشغيل Backend
```bash
cd f:\watan
.\.venv\Scripts\Activate.ps1
python djangoo/manage.py runserver
```

### 3. إعادة تشغيل Frontend
```bash
cd f:\watan\frontend
npm run dev
```

## ✨ الميزات

✅ عرض الرصيد والدين بشكل منفصل لـ ZNET
✅ حساب المحصلة تلقائياً (الرصيد - الدين)
✅ استخدام المحصلة في حساب رأس المال الإجمالي
✅ تصميم مميز لـ ZNET مع خط فاصل
✅ ألوان مختلفة: الرصيد (عادي) / الدين (رمادي فاتح)
✅ المزودون الآخرون يعملون بشكل طبيعي

## 🔮 ملاحظات مستقبلية

- يمكن إضافة API خاص بـ ZNET لتحديث الدين تلقائياً
- يمكن إضافة حقل `debtUpdatedAt` في الواجهة
- يمكن إضافة تنبيه إذا كان الدين أكبر من الرصيد

## 📝 الملفات المعدلة

1. ✅ `djangoo/ADD_DEBT_TO_INTEGRATIONS.sql` - SQL Migration
2. ✅ `djangoo/apps/providers/models.py` - Django Model
3. ✅ `djangoo/apps/reports/views.py` - Backend API
4. ✅ `frontend/src/app/admin/reports/capital/page.tsx` - Frontend UI

---
**تاريخ الإنشاء:** 2025-10-17
**الحالة:** ✅ جاهز للتطبيق
