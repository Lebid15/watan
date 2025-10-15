from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.users'
    verbose_name = 'المستخدمون'
    
    def ready(self):
        """تفعيل الـ signals عند بدء التطبيق"""
        import apps.users.signals  # noqa: F401
