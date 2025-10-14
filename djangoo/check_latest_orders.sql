SELECT 
    SUBSTRING(id::text, 1, 8) as id_short,
    status,
    cost_usd_at_order,
    sell_usd_at_order,
    profit_usd_at_order,
    price
FROM product_orders 
ORDER BY "createdAt" DESC 
LIMIT 3;
