from __future__ import annotations

from django.db import models


"""
⚠️ LEGACY TENANT MODELS - FOR REFERENCE ONLY ⚠️

These models map to tables from the old NestJS backend:
- 'tenant' table
- 'tenant_domain' table

They are NOT managed by Django (managed=False) and should NOT be used for new development.
They are kept here ONLY for:
1. Understanding the old tenant schema structure
2. Potential data migration scripts
3. Reference when comparing old vs new tenant models

For new development, use: apps.tenancy.models.Tenant (table: 'dj_tenants')
"""


class Tenant(models.Model):
    """Legacy Tenant model from old NestJS backend - DO NOT USE
    
    Use apps.tenancy.models.Tenant instead for all new development.
    """
    class Meta:
        db_table = 'tenant'
        managed = False
        verbose_name = 'Legacy Tenant (Old NestJS Backend)'
        verbose_name_plural = 'Legacy Tenants (Old NestJS Backend - REFERENCE ONLY)'

    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=40)
    owner_user_id = models.UUIDField(null=True, db_column='ownerUserId')
    is_active = models.BooleanField(default=True, db_column='isActive')
    created_at = models.DateTimeField(db_column='createdAt')
    updated_at = models.DateTimeField(db_column='updatedAt', null=True)
    deleted_at = models.DateTimeField(null=True)


class TenantDomain(models.Model):
    """Legacy TenantDomain model from old NestJS backend - DO NOT USE
    
    Use apps.tenancy.models for tenant domain management in new development.
    """
    class Meta:
        db_table = 'tenant_domain'
        managed = False
        verbose_name = 'Legacy Tenant Domain (Old NestJS Backend)'
        verbose_name_plural = 'Legacy Tenant Domains (Old NestJS Backend - REFERENCE ONLY)'

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    domain = models.CharField(max_length=190)
    type = models.CharField(max_length=20, default='subdomain')
    is_primary = models.BooleanField(default=False, db_column='isPrimary')
    is_verified = models.BooleanField(default=False, db_column='isVerified')
    created_at = models.DateTimeField(db_column='createdAt')
    updated_at = models.DateTimeField(db_column='updatedAt', null=True)
    deleted_at = models.DateTimeField(null=True)
