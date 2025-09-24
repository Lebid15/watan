from __future__ import annotations

from django.db import models


class PaymentMethod(models.Model):
    class Meta:
        db_table = 'payment_method'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True, null=True)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True, db_column='isActive')
    # columns present in DB
    type = models.CharField(max_length=50)
    config = models.JSONField(null=True)
    logo_url = models.CharField(max_length=512, null=True, db_column='logoUrl')
    note = models.TextField(null=True)
    created_at = models.DateTimeField(db_column='createdAt', null=True)
    updated_at = models.DateTimeField(db_column='updatedAt', null=True)


class Deposit(models.Model):
    class Meta:
        db_table = 'deposit'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True, null=True)
    user_id = models.UUIDField(db_column='user_id', db_index=True)
    method_id = models.UUIDField(db_column='method_id', null=True)
    original_amount = models.DecimalField(db_column='originalAmount', max_digits=18, decimal_places=8)
    original_currency = models.CharField(db_column='originalCurrency', max_length=10)
    wallet_currency = models.CharField(db_column='walletCurrency', max_length=10)
    rate_used = models.DecimalField(db_column='rateUsed', max_digits=18, decimal_places=8)
    converted_amount = models.DecimalField(db_column='convertedAmount', max_digits=18, decimal_places=8)
    note = models.TextField(null=True)
    status = models.CharField(max_length=20)  # pending|approved|rejected
    created_at = models.DateTimeField(db_column='createdAt')
    approved_at = models.DateTimeField(db_column='approvedAt', null=True)
    source = models.CharField(max_length=50, null=True)