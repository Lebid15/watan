# Generated migration for adding provider_referans field to product_orders table

from django.db import migrations


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Add provider_referans column if it doesn't exist
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'product_orders' 
                    AND column_name = 'provider_referans'
                ) THEN
                    ALTER TABLE product_orders 
                    ADD COLUMN provider_referans VARCHAR(255);
                END IF;
            END $$;
            
            -- Create index on provider_referans for fast lookups
            CREATE INDEX IF NOT EXISTS idx_orders_provider_referans 
            ON product_orders(provider_referans);
            """,
            reverse_sql="""
            -- Remove index and column
            DROP INDEX IF EXISTS idx_orders_provider_referans;
            ALTER TABLE product_orders DROP COLUMN IF EXISTS provider_referans;
            """
        ),
    ]
