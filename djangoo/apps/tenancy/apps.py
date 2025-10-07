from django.apps import AppConfig


class TenancyConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tenancy'
    # Display name for the app in Django Admin
    verbose_name = 'المستأجرون'
