"""
Migration: Enhance Routing System
إضافة التحسينات لنظام التوجيه
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('providers', '0003_enhance_package_routing'),
    ]

    operations = [
        # إضافة حقول إضافية للتوجيه
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
        
        # إضافة فهارس محسنة
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_package_routing_priority ON package_routing (priority);",
            reverse_sql="DROP INDEX IF EXISTS idx_package_routing_priority;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_package_routing_active ON package_routing (is_active);",
            reverse_sql="DROP INDEX IF EXISTS idx_package_routing_active;"
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_package_routing_priority_active ON package_routing (priority, is_active);",
            reverse_sql="DROP INDEX IF EXISTS idx_package_routing_priority_active;"
        ),
        
        # إضافة constraints محسنة
        migrations.RunSQL(
            """
            ALTER TABLE package_routing 
            ADD CONSTRAINT check_priority_positive 
            CHECK (priority > 0);
            """,
            reverse_sql="ALTER TABLE package_routing DROP CONSTRAINT IF EXISTS check_priority_positive;"
        ),
        
        # إصلاح البيانات الموجودة
        migrations.RunSQL(
            """
            UPDATE package_routing 
            SET priority = 1, is_active = true 
            WHERE priority IS NULL OR is_active IS NULL;
            """,
            reverse_sql="-- No reverse needed"
        ),
        
        # إصلاح التضارب في الإعدادات
        migrations.RunSQL(
            """
            UPDATE package_routing 
            SET mode = 'manual' 
            WHERE mode = 'auto' AND provider_type = 'manual';
            """,
            reverse_sql="-- No reverse needed"
        ),
        
        # إصلاح التوجيهات بدون مزود
        migrations.RunSQL(
            """
            UPDATE package_routing 
            SET mode = 'manual' 
            WHERE mode = 'auto' 
            AND provider_type = 'external' 
            AND "primaryProviderId" IS NULL;
            """,
            reverse_sql="-- No reverse needed"
        ),
        
        # إصلاح التوجيهات بدون مجموعة أكواد
        migrations.RunSQL(
            """
            UPDATE package_routing 
            SET mode = 'manual' 
            WHERE mode = 'auto' 
            AND provider_type IN ('codes', 'internal_codes') 
            AND "codeGroupId" IS NULL;
            """,
            reverse_sql="-- No reverse needed"
        ),
    ]

