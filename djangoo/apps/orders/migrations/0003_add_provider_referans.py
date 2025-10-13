# Generated manually to add provider_referans column

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='productorder',
            name='provider_referans',
            field=models.CharField(max_length=255, null=True, db_column='provider_referans'),
        ),
    ]
