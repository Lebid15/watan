-- إضافة أعمدة USD Snapshot إلى جدول product_orders
-- هذه الأعمدة تحسب فوراً بعد إرسال الطلب للمزود (قبل الموافقة)

-- 1. التكلفة بالدولار (من PackageCost مع تحويل العملة)
ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS cost_usd_at_order NUMERIC(12, 4) DEFAULT NULL;

-- 2. سعر البيع بالدولار
ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS sell_usd_at_order NUMERIC(12, 4) DEFAULT NULL;

-- 3. الربح بالدولار (sell - cost)
ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS profit_usd_at_order NUMERIC(12, 4) DEFAULT NULL;

-- إضافة تعليقات للأعمدة
COMMENT ON COLUMN product_orders.cost_usd_at_order IS 'Cost in USD calculated immediately after dispatch (from PackageCost with currency conversion)';
COMMENT ON COLUMN product_orders.sell_usd_at_order IS 'Selling price in USD at time of order';
COMMENT ON COLUMN product_orders.profit_usd_at_order IS 'Profit in USD (sell - cost) at time of order';

-- ✅ تم!
SELECT 'USD snapshot columns added successfully!' AS status;
