from django.db import migrations


def create_totp_tables(apps, schema_editor):
    connection = schema_editor.connection
    with connection.cursor():
        introspection = connection.introspection
        existing_tables = {name.lower() for name in introspection.table_names()}

    if 'dj_totp_credentials' not in existing_tables:
        TotpCredential = apps.get_model('users', 'TotpCredential')
        schema_editor.create_model(TotpCredential)

    if 'dj_recovery_codes' not in existing_tables:
        RecoveryCode = apps.get_model('users', 'RecoveryCode')
        schema_editor.create_model(RecoveryCode)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_alter_legacyuser_options_alter_user_options'),
    ]

    operations = [
        migrations.RunPython(create_totp_tables, migrations.RunPython.noop),
    ]
