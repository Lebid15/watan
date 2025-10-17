# Generated migration for adding debt fields to integrations

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = []

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE integrations 
            ADD COLUMN IF NOT EXISTS debt DECIMAL(18, 3) DEFAULT 0;
            
            ALTER TABLE integrations 
            ADD COLUMN IF NOT EXISTS debt_updated_at TIMESTAMP;
            
            COMMENT ON COLUMN integrations.debt IS 'الدين للمزود (خاص بـ ZNET)';
            COMMENT ON COLUMN integrations.debt_updated_at IS 'تاريخ آخر تحديث للدين';
            """,
            reverse_sql="""
            ALTER TABLE integrations DROP COLUMN IF EXISTS debt;
            ALTER TABLE integrations DROP COLUMN IF EXISTS debt_updated_at;
            """
        ),
    ]
