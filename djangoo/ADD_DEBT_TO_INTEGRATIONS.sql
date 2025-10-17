-- إضافة حقل debt لجدول integrations
-- هذا الحقل سيخزن الدين الخاص بمزود ZNET

ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS debt DECIMAL(18, 3) DEFAULT 0;

ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS debt_updated_at TIMESTAMP;

COMMENT ON COLUMN integrations.debt IS 'الدين للمزود (خاص بـ ZNET)';
COMMENT ON COLUMN integrations.debt_updated_at IS 'تاريخ آخر تحديث للدين';
