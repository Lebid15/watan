from __future__ import annotations

from django.db import models


class Product(models.Model):
    class Meta:
        db_table = 'product'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    custom_image_url = models.CharField(max_length=500, null=True, blank=True, db_column='customImageUrl')
    custom_alt_text = models.CharField(max_length=300, null=True, blank=True, db_column='customAltText')
    thumb_small_url = models.CharField(max_length=500, null=True, blank=True, db_column='thumbSmallUrl')
    thumb_medium_url = models.CharField(max_length=500, null=True, blank=True, db_column='thumbMediumUrl')
    thumb_large_url = models.CharField(max_length=500, null=True, blank=True, db_column='thumbLargeUrl')

    is_active = models.BooleanField(default=True, db_column='isActive')
    supports_counter = models.BooleanField(default=False, db_column='supportsCounter')
    source_global_product_id = models.UUIDField(null=True, blank=True, db_column='sourceGlobalProductId')


class ProductPackage(models.Model):
    class Meta:
        db_table = 'product_packages'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    product = models.ForeignKey(Product, related_name='packages', on_delete=models.DO_NOTHING, db_column='product_id')
    public_code = models.IntegerField(null=True, db_column='publicCode')
    name = models.CharField(max_length=160, null=True)
    description = models.TextField(null=True)
    image_url = models.CharField(max_length=500, null=True, db_column='imageUrl')
    base_price = models.DecimalField(max_digits=10, decimal_places=2, db_column='basePrice', default=0)
    capital = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    type = models.CharField(max_length=10, default='fixed')
    unit_name = models.CharField(max_length=40, null=True, db_column='unitName')
    unit_code = models.CharField(max_length=40, null=True, db_column='unitCode')
    min_units = models.IntegerField(null=True, db_column='minUnits')
    max_units = models.IntegerField(null=True, db_column='maxUnits')
    step = models.DecimalField(max_digits=12, decimal_places=4, null=True)
    provider_name = models.CharField(max_length=120, null=True, db_column='providerName')
    is_active = models.BooleanField(default=True, db_column='isActive')


class PriceGroup(models.Model):
    class Meta:
        db_table = 'price_groups'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True, db_column='isActive')


class PackagePrice(models.Model):
    class Meta:
        db_table = 'package_prices'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    package = models.ForeignKey(ProductPackage, related_name='prices', on_delete=models.DO_NOTHING, db_column='package_id')
    price_group = models.ForeignKey(PriceGroup, on_delete=models.DO_NOTHING, db_column='price_group_id')
