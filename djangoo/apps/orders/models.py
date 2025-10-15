from __future__ import annotations

from django.db import models


"""
⚠️ LEGACY MODELS - FOR REFERENCE ONLY ⚠️

These models map to tables from the old NestJS backend:
- 'product' table
- 'product_packages' table  
- 'users' table
- 'product_orders' table

They are NOT managed by Django (managed=False) and should NOT be used for new development.
They are kept here ONLY for:
1. Understanding the old database schema
2. Potential data migration scripts
3. Reference when implementing new Django models

For new development, use Django models from:
- apps.products.models (for products)
- apps.users.models (for users)
"""


class Product(models.Model):
    """Legacy Product model from old NestJS backend - DO NOT USE"""
    class Meta:
        db_table = 'product'
        managed = False
        app_label = 'orders'

    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=255, null=True)


class ProductPackage(models.Model):
    """Legacy ProductPackage model from old NestJS backend - DO NOT USE"""
    class Meta:
        db_table = 'product_packages'
        managed = False
        app_label = 'orders'

    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=255, null=True)
    product_id = models.UUIDField(null=True, db_column='product_id')


class LegacyUser(models.Model):
    """Legacy User model from old NestJS backend - DO NOT USE
    
    Use apps.users.models.User instead for all new development.
    """
    class Meta:
        db_table = 'users'
        managed = False
        app_label = 'orders'
        verbose_name = 'Legacy User (Old Backend)'
        verbose_name_plural = 'Legacy Users (Old Backend - DO NOT USE)'

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', null=True, db_index=True)
    email = models.CharField(max_length=255)
    username = models.CharField(max_length=255, null=True)
    password = models.CharField(max_length=255, null=True)


class ProductOrder(models.Model):
    """Legacy ProductOrder model from old NestJS backend - DO NOT USE"""
    class Meta:
        db_table = 'product_orders'
        managed = False
        app_label = 'orders'
        verbose_name = 'Legacy Product Order (Old Backend)'
        verbose_name_plural = 'Legacy Product Orders (Old Backend - DO NOT USE)'

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', null=True, db_index=True)
    order_no = models.IntegerField(null=True, db_column='orderNo')
    status = models.CharField(max_length=50, default='pending')
    user = models.ForeignKey(LegacyUser, on_delete=models.DO_NOTHING, db_column='userId', related_name='orders', null=True)
    product = models.ForeignKey(Product, on_delete=models.DO_NOTHING, db_column='productId', null=True)
    package = models.ForeignKey(ProductPackage, on_delete=models.DO_NOTHING, db_column='packageId', null=True)
    quantity = models.IntegerField(default=1)
    sell_price_currency = models.CharField(max_length=10, db_column='sellPriceCurrency', default='USD')
    sell_price_amount = models.DecimalField(max_digits=12, decimal_places=2, db_column='sellPriceAmount', default=0)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Note: keep to baseline columns; newer optional columns like unitPriceApplied/sellPrice may not exist on all DBs
    created_at = models.DateTimeField(db_column='createdAt', auto_now_add=False)
    user_identifier = models.CharField(max_length=255, null=True, db_column='userIdentifier')
    extra_field = models.CharField(max_length=255, null=True, db_column='extraField')
    provider_id = models.CharField(max_length=255, null=True, db_column='providerId')
    external_order_id = models.CharField(max_length=255, null=True, db_column='externalOrderId')
    provider_message = models.TextField(null=True, db_column='providerMessage')
    last_message = models.CharField(max_length=250, null=True, db_column='lastMessage')
    manual_note = models.TextField(null=True, db_column='manualNote')
    notes = models.JSONField(null=True, db_column='notes')
    pin_code = models.CharField(max_length=120, null=True, db_column='pinCode')
    external_status = models.CharField(max_length=30, db_column='externalStatus', default='not_sent')
    sent_at = models.DateTimeField(null=True, db_column='sentAt')
    completed_at = models.DateTimeField(null=True, db_column='completedAt')
    duration_ms = models.IntegerField(null=True, db_column='durationMs')
    last_sync_at = models.DateTimeField(null=True, db_column='lastSyncAt')
    fx_locked = models.BooleanField(default=False, db_column='fxLocked')
    fx_usd_try_at_approval = models.DecimalField(max_digits=12, decimal_places=6, null=True, db_column='fxUsdTryAtApproval')
    sell_try_at_approval = models.DecimalField(max_digits=12, decimal_places=2, null=True, db_column='sellTryAtApproval')
    cost_try_at_approval = models.DecimalField(max_digits=12, decimal_places=2, null=True, db_column='costTryAtApproval')
    profit_try_at_approval = models.DecimalField(max_digits=12, decimal_places=2, null=True, db_column='profitTryAtApproval')
    profit_usd_at_approval = models.DecimalField(max_digits=12, decimal_places=2, null=True, db_column='profitUsdAtApproval')
    fx_captured_at = models.DateTimeField(null=True, db_column='fxCapturedAt')
    approved_at = models.DateTimeField(null=True, db_column='approvedAt')
    approved_local_date = models.DateField(null=True, db_column='approvedLocalDate')
    approved_local_month = models.CharField(max_length=7, null=True, db_column='approvedLocalMonth')
    notes_count = models.IntegerField(default=0, db_column='notesCount')
    provider_referans = models.CharField(max_length=255, null=True, db_column='provider_referans')  # Reference ID sent to provider
    
    # 💰 USD Snapshot fields (calculated immediately after dispatch)
    cost_usd_at_order = models.DecimalField(max_digits=12, decimal_places=4, null=True, db_column='cost_usd_at_order')
    sell_usd_at_order = models.DecimalField(max_digits=12, decimal_places=4, null=True, db_column='sell_usd_at_order')
    profit_usd_at_order = models.DecimalField(max_digits=12, decimal_places=4, null=True, db_column='profit_usd_at_order')
    
    # 💰 TRY Snapshot fields (calculated immediately after dispatch - FROZEN, never recalculated!)
    cost_try_at_order = models.DecimalField(max_digits=12, decimal_places=2, null=True, db_column='cost_try_at_order')
    sell_try_at_order = models.DecimalField(max_digits=12, decimal_places=2, null=True, db_column='sell_try_at_order')
    profit_try_at_order = models.DecimalField(max_digits=12, decimal_places=2, null=True, db_column='profit_try_at_order')
    fx_usd_try_at_order = models.DecimalField(max_digits=12, decimal_places=6, null=True, db_column='fx_usd_try_at_order')

