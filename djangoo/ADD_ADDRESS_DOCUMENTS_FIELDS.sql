-- إضافة الحقول الجديدة للمستأجرين والمستخدمين
-- يجب تنفيذها من قبل مستخدم له صلاحيات كاملة على قاعدة البيانات

-- ===== إضافة الحقول لجدول المستأجرين =====
ALTER TABLE dj_tenants 
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '' NOT NULL,
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb NOT NULL;

COMMENT ON COLUMN dj_tenants.address IS 'العنوان الكامل للمستأجر';
COMMENT ON COLUMN dj_tenants.documents IS 'الوثائق - حد أقصى 3 صور (روابط)';

-- ===== إضافة الحقول لجدول المستخدمين =====
ALTER TABLE dj_users 
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '' NOT NULL,
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb NOT NULL;

COMMENT ON COLUMN dj_users.address IS 'العنوان الكامل للمستخدم';
COMMENT ON COLUMN dj_users.documents IS 'الوثائق - حد أقصى 3 صور (روابط)';

-- ===== تأكيد نجاح الإضافة =====
SELECT 'تم إضافة الحقول بنجاح' AS status;
