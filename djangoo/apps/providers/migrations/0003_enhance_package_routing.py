"""
Migration: Enhance PackageRouting Model
إضافة التحسينات لنموذج PackageRouting
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('providers', '0002_add_debt_fields'),
    ]

    operations = [
        # إضافة حقول جديدة
        migrations.AddField(
            model_name='packagerouting',
            name='priority',
            field=models.IntegerField(
                default=1,
                help_text='أولوية التوجيه (1 = أعلى أولوية)'
            ),
        ),
        migrations.AddField(
            model_name='packagerouting',
            name='is_active',
            field=models.BooleanField(
                default=True,
                help_text='هل التوجيه نشط؟'
            ),
        ),
        migrations.AddField(
            model_name='packagerouting',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                help_text='تاريخ الإنشاء'
            ),
        ),
        migrations.AddField(
            model_name='packagerouting',
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                help_text='تاريخ آخر تحديث'
            ),
        ),
        
        # إضافة فهارس مركبة
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_package_routing_tenant_package ON package_routing (\"tenantId\", package_id);",
            reverse_sql="DROP INDEX IF EXISTS idx_package_routing_tenant_package;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_package_routing_tenant_provider ON package_routing (\"tenantId\", \"providerType\");",
            reverse_sql="DROP INDEX IF EXISTS idx_package_routing_tenant_provider;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_package_routing_mode_provider ON package_routing (mode, \"providerType\");",
            reverse_sql="DROP INDEX IF EXISTS idx_package_routing_mode_provider;"
        ),
        
        # إضافة constraints للتحقق من الصحة
        migrations.RunSQL(
            """
            ALTER TABLE package_routing 
            ADD CONSTRAINT check_auto_external_has_provider 
            CHECK (
                (mode = 'manual') OR 
                (mode = 'auto' AND provider_type != 'external') OR 
                (mode = 'auto' AND provider_type = 'external' AND \"primaryProviderId\" IS NOT NULL)
            );
            """,
            reverse_sql="ALTER TABLE package_routing DROP CONSTRAINT IF EXISTS check_auto_external_has_provider;"
        ),
        
        migrations.RunSQL(
            """
            ALTER TABLE package_routing 
            ADD CONSTRAINT check_auto_codes_has_group 
            CHECK (
                (mode = 'manual') OR 
                (mode = 'auto' AND provider_type NOT IN ('codes', 'internal_codes')) OR 
                (mode = 'auto' AND provider_type IN ('codes', 'internal_codes') AND \"codeGroupId\" IS NOT NULL)
            );
            """,
            reverse_sql="ALTER TABLE package_routing DROP CONSTRAINT IF EXISTS check_auto_codes_has_group;"
        ),
        
        # إضافة constraint لمنع التضارب
        migrations.RunSQL(
            """
            ALTER TABLE package_routing 
            ADD CONSTRAINT check_no_manual_auto_conflict 
            CHECK (
                NOT (mode = 'auto' AND provider_type = 'manual')
            );
            """,
            reverse_sql="ALTER TABLE package_routing DROP CONSTRAINT IF EXISTS check_no_manual_auto_conflict;"
        ),
    ]

