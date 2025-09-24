from __future__ import annotations

from django.db import models


class LegacyUser(models.Model):
    class Meta:
        db_table = 'users'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', null=True, db_index=True)
    email = models.CharField(max_length=255)
    password = models.CharField(max_length=255)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    role = models.CharField(max_length=50, null=True)
    username = models.CharField(max_length=255, null=True)
    is_active = models.BooleanField(default=True, db_column='isActive')
    overdraft_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0, db_column='overdraftLimit')
    price_group_id = models.UUIDField(null=True, db_column='price_group_id')
    preferred_currency_code = models.CharField(max_length=10, null=True, db_column='preferredCurrencyCode')
