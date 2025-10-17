# إضافة حقول العنوان والوثائق للمستخدمين والمستأجرين

## 📋 نظرة عامة
تم إضافة حقلين جديدين لكل من **المستخدمين (Users)** و**المستأجرين (Tenants)**:
1. **العنوان الكامل** (حقل نصي)
2. **الوثائق** (رفع حد أقصى 3 صور)

---

## 🎯 الحقول المضافة

### للمستخدم (User):
```python
address = models.TextField(blank=True, verbose_name='العنوان الكامل')
documents = models.JSONField(default=list, blank=True, verbose_name='الوثائق')
```

### للمستأجر (Tenant):
```python
address = models.TextField(blank=True, verbose_name='العنوان الكامل')
documents = models.JSONField(default=list, blank=True, verbose_name='الوثائق')
```

---

## 🔧 التعديلات المطبقة

### 1. Backend (Django)

#### ✅ الموديلات (Models)
- **ملف:** `djangoo/apps/users/models.py`
  - أضيف `address` و `documents`
  
- **ملف:** `djangoo/apps/tenancy/models.py`
  - أضيف `address` و `documents`

#### ✅ Django Admin
- **ملف:** `djangoo/apps/tenancy/admin.py`
  - أضيفت الحقول الجديدة في `fieldsets`
  - أضيف `address` في `search_fields`

#### ✅ API Serializers
- **ملف:** `djangoo/apps/users/serializers.py`
  - أضيف `address` و `documents` في `AdminUserSerializer`

#### ✅ API Views
- **ملف:** `djangoo/apps/users/views.py`
  - أضيف دعم `address` في endpoint التعديل (PUT)
  - أضيف `address` و `documents` في `_user_detail_payload`
  - **Endpoint جديد:** `upload_user_document` - رفع وثيقة (صورة)
  - **Endpoint جديد:** `delete_user_document` - حذف وثيقة

#### ✅ API URLs
- **ملف:** `djangoo/apps/users/urls.py`
  - `POST /api-dj/users/documents/upload` - رفع وثيقة
  - `DELETE /api-dj/users/{user_id}/documents/delete` - حذف وثيقة

---

### 2. قاعدة البيانات (Database)

#### ⚠️ SQL Script (يجب تنفيذه يدوياً)
**ملف:** `djangoo/ADD_ADDRESS_DOCUMENTS_FIELDS.sql`

```sql
-- يجب تنفيذه من قبل مستخدم له صلاحيات كاملة
ALTER TABLE dj_tenants 
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '' NOT NULL,
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE dj_users 
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '' NOT NULL,
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb NOT NULL;
```

**طريقة التنفيذ:**
```bash
# الطريقة 1: من psql
psql -U postgres -d your_database_name -f djangoo/ADD_ADDRESS_DOCUMENTS_FIELDS.sql

# الطريقة 2: من pgAdmin
# انسخ محتوى الملف وألصقه في Query Tool ثم Run
```

---

### 3. Frontend (React/Next.js)

#### ✅ صفحة تعديل المستخدم
- **ملف:** `frontend/src/app/admin/users/[id]/page.tsx`

**المميزات المضافة:**
1. **حقل العنوان:**
   - Textarea لإدخال العنوان الكامل
   - يُحفظ مع بقية البيانات عند الضغط على "حفظ"

2. **رفع الوثائق:**
   - رفع حد أقصى 3 صور
   - أنواع الملفات المدعومة: JPG, PNG, GIF, WebP
   - معاينة الصور المرفوعة
   - زر حذف لكل صورة

---

## 📡 API Endpoints

### رفع وثيقة
```http
POST /api-dj/users/documents/upload
Content-Type: multipart/form-data

Body:
- file: [الملف]
- userId: [معرف المستخدم]

Response:
{
  "url": "http://example.com/media/documents/users/filename.jpg",
  "documents": ["url1", "url2", ...]
}
```

### حذف وثيقة
```http
DELETE /api-dj/users/{user_id}/documents/delete
Content-Type: application/json

Body:
{
  "documentUrl": "http://example.com/media/documents/users/filename.jpg"
}

Response:
{
  "documents": ["url1", ...]
}
```

### تحديث بيانات المستخدم (يشمل العنوان)
```http
PUT /api-dj/users/{user_id}
Content-Type: application/json

Body:
{
  "fullName": "...",
  "username": "...",
  "address": "العنوان الكامل هنا",
  ...
}
```

---

## 🎨 واجهة المستخدم (UI)

### في صفحة تعديل المستخدم (`/admin/users/{id}`):

#### حقل العنوان:
```
┌─────────────────────────────────┐
│ العنوان الكامل                 │
├─────────────────────────────────┤
│ [نص متعدد الأسطر]              │
│                                 │
│                                 │
└─────────────────────────────────┘
```

#### قسم الوثائق:
```
الوثائق (حد أقصى 3 صور)
┌─────────┐ ┌─────────┐ ┌─────────┐
│  صورة 1 │ │  صورة 2 │ │  صورة 3 │
│    ✕    │ │    ✕    │ │    ✕    │
└─────────┘ └─────────┘ └─────────┘

[📎 رفع وثيقة]

الملفات المدعومة: JPG, PNG, GIF, WebP
```

---

## ✅ خطوات الاختبار

### 1. تنفيذ SQL Script
```bash
cd djangoo
psql -U your_superuser -d your_database -f ADD_ADDRESS_DOCUMENTS_FIELDS.sql
```

### 2. إعادة تشغيل Django
```bash
cd djangoo
.\.venv\Scripts\Activate.ps1
python manage.py runserver
```

### 3. اختبار من Frontend

#### في لوحة تحكم المستأجر:
1. انتقل إلى `/admin/users`
2. اختر مستخدم واضغط "تعديل"
3. **أدخل عنواناً** في حقل "العنوان الكامل"
4. **ارفع صورة** (حد أقصى 3)
5. احفظ التغييرات
6. تحقق من حفظ البيانات بإعادة فتح الصفحة

#### في Django Admin:
1. انتقل إلى `/admin/tenancy/tenant/`
2. اختر مستأجر
3. افتح قسم "العنوان والوثائق"
4. أدخل العنوان والوثائق (يدوياً - كـ JSON)

---

## 📁 هيكل الملفات المعدلة

```
djangoo/
├── apps/
│   ├── tenancy/
│   │   ├── models.py           ✅ تم التعديل
│   │   └── admin.py            ✅ تم التعديل
│   ├── users/
│   │   ├── models.py           ✅ تم التعديل
│   │   ├── serializers.py      ✅ تم التعديل
│   │   ├── views.py            ✅ تم التعديل
│   │   └── urls.py             ✅ تم التعديل
└── ADD_ADDRESS_DOCUMENTS_FIELDS.sql   ✅ جديد

frontend/
└── src/
    └── app/
        └── admin/
            └── users/
                └── [id]/
                    └── page.tsx    ✅ تم التعديل
```

---

## 🔒 الأمان والتحقق

### Backend:
- ✅ التحقق من نوع الملف (صور فقط)
- ✅ التحقق من عدد الوثائق (حد أقصى 3)
- ✅ التحقق من صلاحيات المستخدم (IsAuthenticated)
- ✅ التحقق من tenant_id

### Frontend:
- ✅ تعطيل زر الرفع عند الوصول للحد الأقصى
- ✅ رسالة تأكيد عند الحذف
- ✅ معالجة الأخطاء وعرض رسائل واضحة

---

## 📝 ملاحظات مهمة

1. **الصور تُخزن في:** `media/documents/users/`
2. **حقل documents يخزن:** روابط الصور كـ JSON Array
3. **الحد الأقصى:** 3 صور لكل مستخدم
4. **يجب تنفيذ SQL Script يدوياً** بسبب صلاحيات قاعدة البيانات
5. **الحقول اختيارية** (blank=True) - لن تسبب أخطاء للبيانات الموجودة

---

## 🎉 انتهى!

تم إضافة كل المتطلبات بنجاح:
- ✅ حقل العنوان للمستخدم والمستأجر
- ✅ رفع 3 وثائق (صور) للمستخدم
- ✅ عرض وحذف الوثائق
- ✅ تحديث Django Admin
- ✅ تحديث API
- ✅ تحديث Frontend

**الخطوة التالية:** تنفيذ SQL Script والاختبار!
