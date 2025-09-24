from __future__ import annotations

from django.db import models


class CodeGroup(models.Model):
    class Meta:
        db_table = 'code_group'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    name = models.CharField(max_length=64)
    public_code = models.CharField(max_length=32, db_column='publicCode')
    note = models.TextField(null=True, blank=True)
    provider_type = models.CharField(max_length=32, default='internal_codes', db_column='providerType')
    is_active = models.BooleanField(default=True, db_column='isActive')
    created_at = models.DateTimeField(db_column='createdAt', auto_now_add=True)
    updated_at = models.DateTimeField(db_column='updatedAt', auto_now=True)


class CodeItem(models.Model):
    class Meta:
        db_table = 'code_item'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    group = models.ForeignKey(CodeGroup, on_delete=models.DO_NOTHING, db_column='groupId', related_name='items')
    pin = models.CharField(max_length=256, null=True, blank=True)
    serial = models.CharField(max_length=256, null=True, blank=True)
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=16, default='available')
    order_id = models.UUIDField(null=True, blank=True, db_column='orderId')
    reserved_at = models.DateTimeField(null=True, blank=True, db_column='reservedAt')
    used_at = models.DateTimeField(null=True, blank=True, db_column='usedAt')
    created_at = models.DateTimeField(db_column='createdAt', auto_now_add=True)
    updated_at = models.DateTimeField(db_column='updatedAt', auto_now=True)
