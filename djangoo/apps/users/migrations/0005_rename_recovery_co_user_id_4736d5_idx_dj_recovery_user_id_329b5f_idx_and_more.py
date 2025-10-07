from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_legacyuser'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterModelTable(
                    name='recoverycode',
                    table='dj_recovery_codes',
                ),
                migrations.AlterModelTable(
                    name='totpcredential',
                    table='dj_totp_credentials',
                ),
            ],
            database_operations=[],
        ),
        migrations.RunSQL(
            sql='''
                CREATE TABLE IF NOT EXISTS dj_recovery_codes (
                    id UUID PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES dj_users(id) ON DELETE CASCADE,
                    code_hash VARCHAR(200) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    used_at TIMESTAMPTZ NULL
                );
                CREATE INDEX IF NOT EXISTS dj_recovery_user_idx ON dj_recovery_codes(user_id);
            ''',
            reverse_sql='''
                DROP TABLE IF EXISTS dj_recovery_codes CASCADE;
            ''',
        ),
        migrations.RunSQL(
            sql='''
                CREATE TABLE IF NOT EXISTS dj_totp_credentials (
                    id UUID PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES dj_users(id) ON DELETE CASCADE,
                    tenant_id UUID NULL,
                    encrypted_secret VARCHAR(200) NOT NULL,
                    label VARCHAR(100) NULL,
                    is_active BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_used_at TIMESTAMPTZ NULL,
                    usage_count INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS dj_totp_user_idx ON dj_totp_credentials(user_id);
                CREATE INDEX IF NOT EXISTS dj_totp_tenant_user_idx ON dj_totp_credentials(tenant_id, user_id);
            ''',
            reverse_sql='''
                DROP TABLE IF EXISTS dj_totp_credentials CASCADE;
            ''',
        ),
    ]
