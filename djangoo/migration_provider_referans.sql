-- Migration Script for Order Monitoring System
-- This script adds the provider_referans field to product_orders table

-- Check if column exists before adding
DO $$
BEGIN
    -- Add provider_referans column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'product_orders' 
        AND column_name = 'provider_referans'
    ) THEN
        ALTER TABLE product_orders 
        ADD COLUMN provider_referans VARCHAR(255);
        
        RAISE NOTICE 'Column provider_referans added successfully';
    ELSE
        RAISE NOTICE 'Column provider_referans already exists';
    END IF;
    
    -- Create index on provider_referans
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 'product_orders'
        AND indexname = 'idx_orders_provider_referans'
    ) THEN
        CREATE INDEX idx_orders_provider_referans 
        ON product_orders(provider_referans);
        
        RAISE NOTICE 'Index idx_orders_provider_referans created successfully';
    ELSE
        RAISE NOTICE 'Index idx_orders_provider_referans already exists';
    END IF;
END $$;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'product_orders' 
AND column_name = 'provider_referans';
