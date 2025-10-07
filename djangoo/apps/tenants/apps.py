from django.apps import AppConfig


class TenantsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.tenants"
    # Display name for the app in Django Admin (legacy, read-only mirror)
    verbose_name = "بيانات المستأجرين (قديمة)"
