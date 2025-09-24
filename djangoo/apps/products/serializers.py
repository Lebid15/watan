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

    class Meta:
        model = ProductPackage
        fields = [
            'id','tenant_id','public_code','name','description','image_url','basePrice','capital','type',
            'unit_name','unit_code','min_units','max_units','step','provider_name','is_active'
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
    packages = ProductPackageSerializer(many=True)
    imageUrl = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id','tenant_id','name','description','is_active','supports_counter',
                  'imageUrl','custom_image_url','thumb_small_url','thumb_medium_url','thumb_large_url','packages']

    def get_imageUrl(self, obj):
        return obj.custom_image_url or None


class ProductDetailSerializer(ProductListSerializer):
    pass


class PriceGroupSerializer(serializers.ModelSerializer):
    isActive = serializers.BooleanField(source='is_active')

    class Meta:
        model = PriceGroup
        fields = ['id', 'name', 'isActive']

