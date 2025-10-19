from django.db import migrations


FORWARD_SQL = """
-- Phase 1: chain scaffolding columns (idempotent)
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS root_order_id UUID;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS mode VARCHAR(50);
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS cost_source VARCHAR(50);
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS cost_price_usd NUMERIC(12, 4);
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS chain_path TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'product_orders_root_order_id_fkey'
    ) THEN
        ALTER TABLE product_orders
            ADD CONSTRAINT product_orders_root_order_id_fkey
            FOREIGN KEY (root_order_id) REFERENCES product_orders(id) ON DELETE SET NULL;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_product_orders_root_order_id
    ON product_orders(root_order_id);

CREATE TABLE IF NOT EXISTS order_dispatch_log (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    result VARCHAR(50),
    message TEXT,
    payload_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'order_dispatch_log'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'order_dispatch_log_order_id_fkey'
        ) THEN
            ALTER TABLE order_dispatch_log
                ADD CONSTRAINT order_dispatch_log_order_id_fkey
                FOREIGN KEY (order_id) REFERENCES product_orders(id) ON DELETE CASCADE;
        END IF;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_order_dispatch_log_order_id_created_at
    ON order_dispatch_log(order_id, created_at DESC);

UPDATE product_orders
SET root_order_id = id
WHERE root_order_id IS NULL;
"""


REVERSE_SQL = """
-- Rollback Phase 1 schema changes
DROP INDEX IF EXISTS idx_order_dispatch_log_order_id_created_at;
ALTER TABLE order_dispatch_log DROP CONSTRAINT IF EXISTS order_dispatch_log_order_id_fkey;
DROP TABLE IF EXISTS order_dispatch_log;

DROP INDEX IF EXISTS idx_product_orders_root_order_id;
ALTER TABLE product_orders DROP CONSTRAINT IF EXISTS product_orders_root_order_id_fkey;
ALTER TABLE product_orders DROP COLUMN IF EXISTS chain_path;
ALTER TABLE product_orders DROP COLUMN IF EXISTS cost_price_usd;
ALTER TABLE product_orders DROP COLUMN IF EXISTS cost_source;
ALTER TABLE product_orders DROP COLUMN IF EXISTS mode;
ALTER TABLE product_orders DROP COLUMN IF EXISTS root_order_id;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0003_add_provider_referans"),
    ]

    operations = [
        migrations.RunSQL(sql=FORWARD_SQL, reverse_sql=REVERSE_SQL),
    ]
