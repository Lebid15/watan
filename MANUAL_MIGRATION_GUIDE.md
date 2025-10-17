# 🔧 تطبيق Migration يدوياً

## المشكلة:
المستخدم `watan` ليس له صلاحيات `ALTER TABLE`

## الحل:
استخدم أحد الطرق التالية:

---

### ✅ الطريقة 1: استخدام pgAdmin أو أي SQL Client

افتح pgAdmin واتصل بقاعدة البيانات، ثم نفذ:

```sql
-- 1. إضافة حقل debt
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS debt DECIMAL(18, 3) DEFAULT 0;

-- 2. إضافة حقل debt_updated_at  
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS debt_updated_at TIMESTAMP;

-- 3. إضافة تعليقات توضيحية
COMMENT ON COLUMN integrations.debt IS 'الدين للمزود (خاص بـ ZNET)';
COMMENT ON COLUMN integrations.debt_updated_at IS 'تاريخ آخر تحديث للدين';
```

---

### ✅ الطريقة 2: استخدام psql من Terminal

```bash
# الاتصال بقاعدة البيانات كـ postgres (المستخدم الرئيسي)
psql -U postgres -d watan

# ثم نفذ الأوامر:
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS debt DECIMAL(18, 3) DEFAULT 0;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS debt_updated_at TIMESTAMP;
```

---

### ✅ الطريقة 3: إعطاء صلاحيات للمستخدم watan

```bash
# الاتصال كـ postgres
psql -U postgres -d watan

# إعطاء صلاحيات
ALTER TABLE integrations OWNER TO watan;
GRANT ALL PRIVILEGES ON TABLE integrations TO watan;
```

ثم أعد تشغيل:
```bash
cd f:\watan\djangoo
python apply_debt_migration.py
```

---

### ✅ الطريقة 4: تنفيذ SQL مباشرة (الأسهل!)

```bash
cd f:\watan\djangoo
psql -U postgres -d watan -f ADD_DEBT_TO_INTEGRATIONS.sql
```

---

## بعد تطبيق Migration:

1. ✅ تأكد من إضافة الأعمدة:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'integrations' 
AND column_name IN ('debt', 'debt_updated_at');
```

2. ✅ أعد تشغيل Backend:
```bash
cd f:\watan\djangoo
python manage.py runserver
```

3. ✅ افتح صفحة الجرد وتحقق من العرض الجديد!

---

## 💡 نصيحة:
إذا كنت تستخدم Docker، قد يكون لديك مستخدم `postgres` مختلف.
تحقق من `docker-compose.yml` للحصول على التفاصيل.
