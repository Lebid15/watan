from rest_framework import serializers
from .models import Currency


class CurrencySerializer(serializers.ModelSerializer):
    isActive = serializers.BooleanField(source='is_active')
    isPrimary = serializers.BooleanField(source='is_primary')
    symbolAr = serializers.CharField(source='symbol_ar', allow_null=True, required=False)

    class Meta:
        model = Currency
        fields = ['id', 'code', 'name', 'rate', 'isActive', 'isPrimary', 'symbolAr']


class CurrencyCreateUpdateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=16, required=False)
    name = serializers.CharField(max_length=200, required=False)
    rate = serializers.DecimalField(max_digits=10, decimal_places=4, required=False)
    isActive = serializers.BooleanField(required=False)
    isPrimary = serializers.BooleanField(required=False)
    symbolAr = serializers.CharField(max_length=32, allow_null=True, required=False)
