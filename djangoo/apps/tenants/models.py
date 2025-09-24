from __future__ import annotations

from django.db import models


class Tenant(models.Model):
    class Meta:
        db_table = 'tenant'
        managed = False

    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=40)
    owner_user_id = models.UUIDField(null=True, db_column='ownerUserId')
    is_active = models.BooleanField(default=True, db_column='isActive')
    created_at = models.DateTimeField(db_column='createdAt')
    updated_at = models.DateTimeField(db_column='updatedAt', null=True)
    deleted_at = models.DateTimeField(null=True)


class TenantDomain(models.Model):
    class Meta:
        db_table = 'tenant_domain'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    domain = models.CharField(max_length=190)
    type = models.CharField(max_length=20, default='subdomain')
    is_primary = models.BooleanField(default=False, db_column='isPrimary')
    is_verified = models.BooleanField(default=False, db_column='isVerified')
    created_at = models.DateTimeField(db_column='createdAt')
    updated_at = models.DateTimeField(db_column='updatedAt', null=True)
    deleted_at = models.DateTimeField(null=True)
