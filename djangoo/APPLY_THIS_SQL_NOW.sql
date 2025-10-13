-- ========================================
-- URGENT: Apply this SQL manually!
-- ========================================
-- This SQL must be run by a database user with owner privileges
-- on the product_orders table (e.g., postgres superuser)

-- Option 1: Run via psql
-- psql -U postgres -d watan -f THIS_FILE.sql

-- Option 2: Run via pgAdmin or any SQL client
-- Copy and paste the SQL below

-- ========================================
-- SQL to add provider_referans column
-- ========================================

-- Add the column
ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS provider_referans VARCHAR(255);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_provider_referans 
ON product_orders(provider_referans);

-- Verify the changes
SELECT 
    'Column added successfully!' as status,
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'product_orders' 
AND column_name = 'provider_referans';

-- Check index
SELECT 
    'Index created successfully!' as status,
    indexname,
    tablename
FROM pg_indexes 
WHERE tablename = 'product_orders' 
AND indexname = 'idx_orders_provider_referans';

-- ========================================
-- Expected Output:
-- ========================================
-- status                        | column_name      | data_type         | character_maximum_length
-- ------------------------------+------------------+-------------------+-------------------------
-- Column added successfully!    | provider_referans| character varying | 255
--
-- status                        | indexname                    | tablename
-- ------------------------------+------------------------------+--------------
-- Index created successfully!   | idx_orders_provider_referans | product_orders
