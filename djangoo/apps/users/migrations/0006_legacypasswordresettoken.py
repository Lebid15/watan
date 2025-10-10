from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_rename_recovery_co_user_id_4736d5_idx_dj_recovery_user_id_329b5f_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='LegacyPasswordResetToken',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('user_id', models.UUIDField(db_index=True)),
                ('tenant_id', models.UUIDField(blank=True, db_index=True, null=True)),
                ('token_hash', models.CharField(max_length=128, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('used_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'db_table': 'dj_password_reset_tokens',
            },
        ),
        migrations.AddIndex(
            model_name='legacypasswordresettoken',
            index=models.Index(fields=['user_id', 'used_at'], name='dj_pwdreset_user_used_idx'),
        ),
    ]
