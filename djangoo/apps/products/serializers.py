from rest_framework import serializers
from .models import Product, ProductPackage, PackagePrice, PriceGroup


class PackagePriceInlineSerializer(serializers.Serializer):
    id = serializers.UUIDField(allow_null=True)
    groupId = serializers.UUIDField(source='price_group.id')
    groupName = serializers.CharField(source='price_group.name')
    price = serializers.DecimalField(max_digits=10, decimal_places=2)


class ProductPackageSerializer(serializers.ModelSerializer):
    basePrice = serializers.SerializerMethodField()
    prices = serializers.SerializerMethodField()
    # Camel-cased aliases expected by the frontend
    publicCode = serializers.IntegerField(source='public_code', allow_null=True)
    isActive = serializers.BooleanField(source='is_active')
    unitName = serializers.CharField(source='unit_name', allow_null=True)
    unitCode = serializers.CharField(source='unit_code', allow_null=True)
    minUnits = serializers.IntegerField(source='min_units', allow_null=True)
    maxUnits = serializers.IntegerField(source='max_units', allow_null=True)
    imageUrl = serializers.CharField(source='image_url', allow_null=True)
    providerName = serializers.CharField(source='provider_name', allow_null=True)

    class Meta:
        model = ProductPackage
        fields = [
            'id', 'publicCode', 'name', 'description', 'imageUrl', 'basePrice', 'capital', 'type',
            'unitName', 'unitCode', 'minUnits', 'maxUnits', 'step', 'providerName', 'isActive', 'prices'
        ]

    def get_basePrice(self, obj):
        return obj.base_price or obj.capital or 0

    def get_prices(self, obj):
        all_groups = self.context.get('all_price_groups') or []
        by_group = {pp.price_group_id: pp for pp in getattr(obj, '_price_rows', [])}
        data = []
        for g in all_groups:
            pp = by_group.get(g.id)
            data.append({
                'id': getattr(pp, 'id', None),
                'groupId': g.id,
                'groupName': g.name,
                'price': getattr(pp, 'price', 0),
            })
        return data


class ProductListSerializer(serializers.ModelSerializer):
    packages = serializers.SerializerMethodField()
    imageUrl = serializers.SerializerMethodField()
    # Camel-cased aliases expected by the frontend
    isActive = serializers.BooleanField(source='is_active')
    supportsCounter = serializers.BooleanField(source='supports_counter')
    customImageUrl = serializers.CharField(source='custom_image_url', allow_null=True)
    thumbSmallUrl = serializers.CharField(source='thumb_small_url', allow_null=True)
    thumbMediumUrl = serializers.CharField(source='thumb_medium_url', allow_null=True)
    thumbLargeUrl = serializers.CharField(source='thumb_large_url', allow_null=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'isActive', 'supportsCounter',
            'imageUrl', 'customImageUrl', 'thumbSmallUrl', 'thumbMediumUrl', 'thumbLargeUrl', 'packages'
        ]

    def get_imageUrl(self, obj):
        return getattr(obj, 'custom_image_url', None) or None

    def get_packages(self, obj):
        # Prefer filtered/ordered packages attached by view
        pkgs = getattr(obj, '_filtered_packages', None)
        if pkgs is None:
            rel = getattr(obj, 'packages', None)
            if hasattr(rel, 'all'):
                pkgs = list(rel.all())
            else:
                pkgs = list(rel or [])
        return ProductPackageSerializer(pkgs, many=True, context=self.context).data


class ProductDetailSerializer(ProductListSerializer):
    pass


class PriceGroupSerializer(serializers.ModelSerializer):
    isActive = serializers.BooleanField(source='is_active')

    class Meta:
        model = PriceGroup
        fields = ['id', 'name', 'isActive']

