from __future__ import annotations

from django.db import models


class TenantApiToken(models.Model):
    class Meta:
        db_table = 'tenant_api_tokens'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    user_id = models.UUIDField(db_column='userId', db_index=True)
    name = models.CharField(max_length=80, null=True)
    token_prefix = models.CharField(max_length=16, db_column='tokenPrefix')
    token_hash = models.CharField(max_length=128, db_column='tokenHash')
    scopes = models.TextField()
    expires_at = models.DateTimeField(null=True, db_column='expiresAt')
    last_used_at = models.DateTimeField(null=True, db_column='lastUsedAt')
    is_active = models.BooleanField(default=True, db_column='isActive')
    created_at = models.DateTimeField(db_column='createdAt')


class IdempotencyKey(models.Model):
    class Meta:
        db_table = 'idempotency_keys'
        managed = False

    id = models.UUIDField(primary_key=True)
    token_id = models.UUIDField(db_column='tokenId', db_index=True)
    key = models.CharField(max_length=80)
    request_hash = models.CharField(max_length=128, db_column='requestHash')
    order_id = models.UUIDField(null=True, db_column='orderId')
    created_at = models.DateTimeField(db_column='createdAt')
    ttl_seconds = models.IntegerField(db_column='ttlSeconds', default=86400)
