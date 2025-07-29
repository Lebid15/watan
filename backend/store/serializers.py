from rest_framework import serializers
from .models import Product, ProductPackage, ProductOrder, PackagePrice
from accounts.models import PriceGroup


class PackagePriceGroupSerializer(serializers.ModelSerializer):
    group_id = serializers.IntegerField(source='group.id')
    group_name = serializers.CharField(source='group.name')

    class Meta:
        model = PackagePrice
        fields = ['group_id', 'group_name', 'price']


class ProductPackageSerializer(serializers.ModelSerializer):
    price_groups = serializers.SerializerMethodField()

    class Meta:
        model = ProductPackage
        fields = ['id', 'name', 'description', 'is_active', 'base_price', 'price_groups']

    def get_price_groups(self, obj):
        prices = PackagePrice.objects.filter(package=obj)
        return PackagePriceGroupSerializer(prices, many=True).data


class ProductSerializer(serializers.ModelSerializer):
    packages = ProductPackageSerializer(many=True, read_only=True)
    packages_count = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(format="%Y-%m-%d", read_only=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'title',
            'slug',
            'image',
            'is_active',
            'packages',
            'packages_count',
            'created_at',
        ]

    def get_packages_count(self, obj):
        return obj.packages.filter(is_active=True).count()


class ProductOrderSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    package_name = serializers.CharField(source='package.name', read_only=True)
    package_price = serializers.DecimalField(source='package.base_price', max_digits=10, decimal_places=2, read_only=True)
    currency_symbol = serializers.SerializerMethodField()

    def get_currency_symbol(self, obj):
        if obj.user and obj.user.currency:
            return obj.user.currency.symbol
        return '₺'  # رمز افتراضي

    class Meta:
        model = ProductOrder
        fields = ['id', 'user_email', 'package_name', 'package_price', 'status', 'created_at', 'currency_symbol']
        read_only_fields = ['id', 'status', 'created_at']



class ProductCreateSerializer(serializers.ModelSerializer):
    packages = ProductPackageSerializer(many=True, required=False)

    class Meta:
        model = Product
        fields = ['title', 'image', 'is_active', 'packages']

    def create(self, validated_data):
        packages_data = validated_data.pop('packages', [])
        product = Product.objects.create(**validated_data)
        for pkg_data in packages_data:
            ProductPackage.objects.create(product=product, **pkg_data)
        return product

class PackagePriceForAdminSerializer(serializers.Serializer):
    group_id = serializers.IntegerField()
    group_name = serializers.CharField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)


class ProductPackageAdminSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    product_id = serializers.IntegerField(source='product.id')
    prices = serializers.SerializerMethodField()

    def get_prices(self, obj):
        from accounts.models import PriceGroup
        from store.models import PackagePrice

        prices_list = []
        all_groups = PriceGroup.objects.all()
        for group in all_groups:
            price_obj = PackagePrice.objects.filter(package=obj, group=group).first()
            prices_list.append({
                "group_id": group.id,
                "group_name": group.name,
                "price": price_obj.price if price_obj else None
            })
        return prices_list
