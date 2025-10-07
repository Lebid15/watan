from __future__ import annotations

import uuid
from django.db import models


class Product(models.Model):
    class Meta:
        db_table = 'product'
        managed = False
        verbose_name = 'منتج'
        verbose_name_plural = 'المنتجات'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    name = models.CharField(max_length=255, verbose_name='اسم المنتج')
    description = models.TextField(null=True, blank=True)

    custom_image_url = models.CharField(max_length=500, null=True, blank=True, db_column='customImageUrl')
    custom_alt_text = models.CharField(max_length=300, null=True, blank=True, db_column='customAltText')
    thumb_small_url = models.CharField(max_length=500, null=True, blank=True, db_column='thumbSmallUrl')
    thumb_medium_url = models.CharField(max_length=500, null=True, blank=True, db_column='thumbMediumUrl')
    thumb_large_url = models.CharField(max_length=500, null=True, blank=True, db_column='thumbLargeUrl')

    is_active = models.BooleanField(default=True, db_column='isActive', verbose_name='الحالة')
    supports_counter = models.BooleanField(default=False, db_column='supportsCounter')
    source_global_product_id = models.UUIDField(null=True, blank=True, db_column='sourceGlobalProductId')

    def __str__(self):
        return self.name or f"Product {self.id}"


class ProductPackage(models.Model):
    class Meta:
        db_table = 'product_packages'
        managed = False
        verbose_name = 'باقة منتج'
        verbose_name_plural = 'باقات المنتجات'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    product = models.ForeignKey(Product, related_name='packages', on_delete=models.DO_NOTHING, db_column='product_id', verbose_name='المنتج')
    public_code = models.IntegerField(null=True, blank=True, db_column='publicCode', verbose_name='رقم الربط (public code)')
    name = models.CharField(max_length=160, null=True, verbose_name='اسم الباقة')
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
    is_active = models.BooleanField(default=True, db_column='isActive', verbose_name='الحالة')

    def __str__(self):
        return self.name or f"Package {self.id}"


class PriceGroup(models.Model):
    class Meta:
        db_table = 'price_groups'
        managed = False
        verbose_name = 'مجموعة أسعار'
        verbose_name_plural = 'مجموعات الأسعار'

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True, db_column='isActive')


class PackagePrice(models.Model):
    class Meta:
        db_table = 'package_prices'
        managed = False
        verbose_name = 'سعر الباقة'
        verbose_name_plural = 'أسعار الباقات'

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    package = models.ForeignKey(ProductPackage, related_name='prices', on_delete=models.DO_NOTHING, db_column='package_id')
    price_group = models.ForeignKey(PriceGroup, on_delete=models.DO_NOTHING, db_column='price_group_id')
