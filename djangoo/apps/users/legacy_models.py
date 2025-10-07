from __future__ import annotations

from django.db import models


"""
⚠️ LEGACY USER MODEL - FOR REFERENCE ONLY ⚠️

This model maps to the 'users' table from the old NestJS backend.

It is NOT managed by Django (managed=False) and should NOT be used for new development.
This file is kept ONLY for:
1. Understanding the old user schema structure  
2. Potential data migration scripts
3. Reference when comparing old vs new user models

For ALL new development, use: apps.users.models.User (table: dj_users)
"""


class LegacyUser(models.Model):
    """Legacy User model from old NestJS backend - DO NOT USE
    
    This represents the old 'users' table structure.
    Use apps.users.models.User instead for all new development.
    """
    class Meta:
        db_table = 'users'
        managed = False
        verbose_name = 'Legacy User (Old NestJS Backend)'
        verbose_name_plural = 'Legacy Users (Old NestJS Backend - REFERENCE ONLY)'

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', null=True, db_index=True)
    email = models.CharField(max_length=255)
    password = models.CharField(max_length=255)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    role = models.CharField(max_length=50, null=True)
    username = models.CharField(max_length=255, null=True)
    full_name = models.CharField(max_length=255, null=True, db_column='fullName')
    phone_number = models.CharField(max_length=255, null=True, db_column='phoneNumber')
    country_code = models.CharField(max_length=32, null=True, db_column='countryCode')
    is_active = models.BooleanField(default=True, db_column='isActive')
    overdraft_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0, db_column='overdraftLimit')
    price_group_id = models.UUIDField(null=True, db_column='price_group_id')
    currency_id = models.UUIDField(null=True, db_column='currency_id')
    preferred_currency_code = models.CharField(max_length=10, null=True, db_column='preferredCurrencyCode')
