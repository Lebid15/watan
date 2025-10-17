-- فحص أعمدة جدول integrations
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'integrations'
ORDER BY ordinal_position;

-- فحص بيانات ZNET
SELECT id, name, provider, balance, "balanceUpdatedAt"
FROM integrations
WHERE provider = 'znet' OR LOWER(name) LIKE '%znet%'
LIMIT 5;
