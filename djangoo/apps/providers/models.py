from __future__ import annotations

from django.db import models


class ProviderAPI(models.Model):
    class Meta:
        db_table = 'provider_api'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True, null=True)
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=60, null=True)
    is_active = models.BooleanField(default=True, db_column='isActive')
    settings = models.JSONField(null=True)
    created_at = models.DateTimeField(db_column='createdAt', null=True)
    updated_at = models.DateTimeField(db_column='updatedAt', null=True)


class PackageMapping(models.Model):
    class Meta:
        db_table = 'package_mappings'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True, null=True)
    our_package_id = models.CharField(max_length=120, db_column='our_package_id')
    provider_api_id = models.CharField(max_length=120, db_column='provider_api_id')
    provider_package_id = models.CharField(max_length=120, db_column='provider_package_id')
    meta = models.JSONField(null=True)


class Integration(models.Model):
    class Meta:
        db_table = 'integrations'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    name = models.CharField(max_length=120)
    provider = models.CharField(max_length=20)
    scope = models.CharField(max_length=10, default='tenant')
    base_url = models.CharField(max_length=255, null=True, db_column='baseUrl')
    api_token = models.CharField(max_length=255, null=True, db_column='apiToken')
    kod = models.CharField(max_length=120, null=True)
    sifre = models.CharField(max_length=120, null=True)
    enabled = models.BooleanField(default=True)
    balance = models.DecimalField(max_digits=18, decimal_places=3, null=True)
    balance_updated_at = models.DateTimeField(null=True, db_column='balanceUpdatedAt')
    debt = models.DecimalField(max_digits=18, decimal_places=3, null=True, default=0)
    debt_updated_at = models.DateTimeField(null=True, db_column='debtUpdatedAt')
    created_at = models.DateTimeField(db_column='createdAt')


class PackageRouting(models.Model):
    class Meta:
        db_table = 'package_routing'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    package_id = models.UUIDField(db_column='package_id')
    mode = models.CharField(max_length=10, default='manual')
    provider_type = models.CharField(max_length=32, db_column='providerType', default='manual')
    primary_provider_id = models.CharField(max_length=255, null=True, db_column='primaryProviderId')
    fallback_provider_id = models.CharField(max_length=255, null=True, db_column='fallbackProviderId')
    code_group_id = models.UUIDField(null=True, db_column='codeGroupId')


class PackageCost(models.Model):
    class Meta:
        db_table = 'package_costs'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    package_id = models.UUIDField(db_column='package_id')
    provider_id = models.CharField(max_length=255, db_column='providerId')
    cost_currency = models.CharField(max_length=10, db_column='costCurrency', default='USD')
    cost_amount = models.DecimalField(max_digits=10, decimal_places=2, db_column='costAmount', default=0)