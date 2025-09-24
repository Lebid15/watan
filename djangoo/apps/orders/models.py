from __future__ import annotations

from django.db import models


class Product(models.Model):
    class Meta:
        db_table = 'product'
        managed = False

    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=255, null=True)


class ProductPackage(models.Model):
    class Meta:
        db_table = 'product_packages'
        managed = False

    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=255, null=True)
    product_id = models.UUIDField(null=True, db_column='product_id')


class LegacyUser(models.Model):
    class Meta:
        db_table = 'users'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', null=True, db_index=True)
    email = models.CharField(max_length=255)
    username = models.CharField(max_length=255, null=True)


class ProductOrder(models.Model):
    class Meta:
        db_table = 'product_orders'
        managed = False

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
    fx_locked = models.BooleanField(default=False, db_column='fxLocked')
    approved_local_date = models.DateField(null=True, db_column='approvedLocalDate')
    notes_count = models.IntegerField(default=0, db_column='notesCount')
