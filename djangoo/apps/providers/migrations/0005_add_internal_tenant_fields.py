
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('providers', '0004_enhance_routing_system'),
    ]

    operations = [
        migrations.AddField(
            model_name='packagerouting',
            name='internal_tenant_id',
            field=models.UUIDField(
                blank=True,
                db_column='internalTenantId',
                help_text='معرف المستأجر الداخلي للتوجيه بين المستأجرين',
                null=True
            ),
        ),
        migrations.AddField(
            model_name='packagerouting',
            name='internal_api_user_id',
            field=models.UUIDField(
                blank=True,
                db_column='internalApiUserId',
                help_text='معرف مستخدم API في المستأجر الداخلي (مثل diana)',
                null=True
            ),
        ),
    ]
