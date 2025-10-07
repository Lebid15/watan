-- This migration adjusts the unique constraint for product_packages
-- Old: UNIQUE ("tenantId", "publicCode") as ux_pkg_tenant_public_code
-- New: UNIQUE ("tenantId", "product_id", "publicCode") to allow reuse across products

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'product_packages'
          AND c.conname = 'ux_pkg_tenant_public_code'
    ) THEN
        ALTER TABLE product_packages DROP CONSTRAINT ux_pkg_tenant_public_code;
    END IF;
EXCEPTION WHEN undefined_table THEN
    -- table doesn't exist on this DB; ignore
    NULL;
END $$;

-- Create the new composite unique constraint (guarded to avoid duplicates)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'product_packages'
          AND c.conname = 'ux_pkg_tenant_product_public_code'
    ) THEN
        ALTER TABLE product_packages
        ADD CONSTRAINT ux_pkg_tenant_product_public_code
        UNIQUE ("tenantId", "product_id", "publicCode");
    END IF;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;
