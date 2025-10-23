# Generated migration for initial providers app

from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Integration',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('type', models.CharField(max_length=50)),
                ('config', models.JSONField()),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'integrations',
            },
        ),
        migrations.CreateModel(
            name='PackageRouting',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tenant_id', models.UUIDField(db_column='tenantId')),
                ('package_id', models.UUIDField()),
                ('mode', models.CharField(default='manual', max_length=10)),
                ('provider_type', models.CharField(db_column='providerType', default='manual', max_length=32)),
                ('primary_provider_id', models.CharField(blank=True, db_column='primaryProviderId', max_length=255, null=True)),
                ('fallback_provider_id', models.CharField(blank=True, db_column='fallbackProviderId', max_length=255, null=True)),
                ('code_group_id', models.UUIDField(blank=True, db_column='codeGroupId', null=True)),
            ],
            options={
                'db_table': 'package_routing',
            },
        ),
    ]
