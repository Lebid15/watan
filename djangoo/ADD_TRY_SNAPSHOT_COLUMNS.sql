-- إضافة أعمدة TRY Snapshot إلى جدول product_orders
-- هذه الأعمدة تُحسب مرة واحدة عند إنشاء الطلب ولا تتغير أبداً!
-- حتى لو تغير سعر الصرف في المستقبل

-- 1. التكلفة بالليرة (محسوبة من cost_usd_at_order × سعر الصرف وقت الطلب)
ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS cost_try_at_order NUMERIC(12, 2) DEFAULT NULL;

-- 2. سعر البيع بالليرة (محسوب من sell_usd_at_order × سعر الصرف وقت الطلب)
ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS sell_try_at_order NUMERIC(12, 2) DEFAULT NULL;

-- 3. الربح بالليرة (محسوب من profit_usd_at_order × سعر الصرف وقت الطلب)
ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS profit_try_at_order NUMERIC(12, 2) DEFAULT NULL;

-- 4. سعر الصرف وقت الطلب (مُجمّد للتاريخ)
ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS fx_usd_try_at_order NUMERIC(12, 6) DEFAULT NULL;

-- إضافة تعليقات للأعمدة
COMMENT ON COLUMN product_orders.cost_try_at_order IS 'Cost in TRY at time of order creation - FROZEN, never recalculated';
COMMENT ON COLUMN product_orders.sell_try_at_order IS 'Selling price in TRY at time of order creation - FROZEN, never recalculated';
COMMENT ON COLUMN product_orders.profit_try_at_order IS 'Profit in TRY at time of order creation - FROZEN, never recalculated';
COMMENT ON COLUMN product_orders.fx_usd_try_at_order IS 'USD to TRY exchange rate at time of order creation - FROZEN for historical accuracy';

-- ✅ تم!
SELECT 'TRY snapshot columns added successfully!' AS status;
