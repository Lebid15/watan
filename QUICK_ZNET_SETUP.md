# 🚀 خطوات تطبيق دعم ZNET Debt

## الخطوة 1️⃣: تطبيق SQL Migration
قم بتشغيل الأمر التالي في قاعدة البيانات الخاصة بك:

```sql
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS debt DECIMAL(18, 3) DEFAULT 0;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS debt_updated_at TIMESTAMP;
```

أو استخدم الملف:
```bash
psql -U your_user -d your_database -f djangoo/ADD_DEBT_TO_INTEGRATIONS.sql
```

## الخطوة 2️⃣: إعادة تشغيل Backend
```bash
cd f:\watan
.\.venv\Scripts\Activate.ps1
python djangoo/manage.py runserver
```

## الخطوة 3️⃣: اختبار التغييرات
1. افتح صفحة الجرد: `http://shamtech.localhost:3000/admin/reports/capital/`
2. ابحث عن مزود ZNET
3. يجب أن ترى:
   - الرصيد / الدين
   - المحصلة تحتهما

---

## ✅ ما تم إنجازه:

### Backend (Django):
- ✅ إضافة حقل `debt` و `debt_updated_at` في Model
- ✅ تعديل API لإرسال `debt` و `netBalance`
- ✅ حساب رأس المال على أساس المحصلة

### Frontend (React):
- ✅ إضافة Types للدين والمحصلة
- ✅ عرض خاص لـ ZNET: الرصيد / الدين / المحصلة
- ✅ تنسيق جميل مع ألوان مختلفة

---

## 📝 ملحوظة هامة:
بعد تطبيق SQL، قم بتحديث بيانات ZNET يدوياً أو عبر API:

```sql
-- مثال: تحديث دين ZNET
UPDATE integrations 
SET debt = 500.00, debt_updated_at = NOW()
WHERE provider = 'znet';
```
