from __future__ import annotations

from django.db import models


class SitePage(models.Model):
    class Meta:
        db_table = 'site_page'
        managed = False
        verbose_name = 'صفحة'
        verbose_name_plural = 'الصفحات'

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True, null=True)
    key = models.CharField(max_length=50, db_index=True)
    content = models.TextField(null=True)
    updated_at = models.DateTimeField(db_column='updatedAt', null=True)
