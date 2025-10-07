from django.db import models


class Tenant(models.Model):
    host = models.CharField(max_length=255, unique=True, db_index=True)
    name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'dj_tenants'
        verbose_name = 'مستأجر'
        verbose_name_plural = 'المستأجرون'

    def __str__(self):
        return self.host
