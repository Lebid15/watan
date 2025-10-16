from __future__ import annotations

from django.db import migrations, models
import django.db.models.deletion
import uuid
from django.conf import settings


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('users', '0012_update_transaction_types'),
    ]

    operations = [
        migrations.CreateModel(
            name='CapitalAdjustment',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
                ('tenant_id', models.UUIDField(db_index=True)),
                ('label', models.CharField(max_length=120)),
                ('currency', models.CharField(default='USD', max_length=12)),
                ('amount', models.DecimalField(max_digits=18, decimal_places=6)),
                ('note', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='capital_adjustments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'capital_adjustments',
                'ordering': ['-created_at'],
                'verbose_name': 'تسوية رأس المال',
                'verbose_name_plural': 'تسويات رأس المال',
            },
        ),
    ]
