from __future__ import annotations

from django.db import models


class Currency(models.Model):
    class Meta:
        db_table = 'currencies'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    code = models.CharField(max_length=16)
    name = models.CharField(max_length=200)
    rate = models.DecimalField(max_digits=10, decimal_places=4, default=1)
    is_active = models.BooleanField(default=True, db_column='isActive')
    is_primary = models.BooleanField(default=False, db_column='isPrimary')
    symbol_ar = models.CharField(max_length=32, null=True, db_column='symbolAr')
