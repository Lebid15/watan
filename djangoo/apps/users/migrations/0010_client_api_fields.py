# Generated manually for Client API fields
# Matching NestJS backend user.entity.ts

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_user_extra_fields'),  # Last migration
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='api_enabled',
            field=models.BooleanField(blank=True, default=False, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='api_token_revoked',
            field=models.BooleanField(blank=True, default=False, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='api_allow_all_ips',
            field=models.BooleanField(blank=True, default=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='api_allow_ips',
            field=models.JSONField(blank=True, default=list, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='api_webhook_url',
            field=models.CharField(blank=True, max_length=300, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='api_last_used_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='api_rate_limit_per_min',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='api_webhook_enabled',
            field=models.BooleanField(blank=True, default=False, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='api_webhook_secret',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='api_webhook_sig_version',
            field=models.CharField(blank=True, default='v1', max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='api_webhook_last_rotated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
