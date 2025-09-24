from __future__ import annotations

from rest_framework import serializers
from .models import ProviderAPI, PackageMapping, Integration, PackageRouting, PackageCost


class ProviderSerializer(serializers.ModelSerializer):
    isActive = serializers.BooleanField(source='is_active')
    createdAt = serializers.DateTimeField(source='created_at', allow_null=True)
    updatedAt = serializers.DateTimeField(source='updated_at', allow_null=True)

    class Meta:
        model = ProviderAPI
        fields = ('id','name','code','isActive','settings','createdAt','updatedAt')


class PackageMappingSerializer(serializers.ModelSerializer):
    tenantId = serializers.UUIDField(source='tenant_id')
    ourPackageId = serializers.UUIDField(source='our_package_id')
    providerApiId = serializers.UUIDField(source='provider_api_id')
    providerPackageId = serializers.CharField(source='provider_package_id')
    createdAt = serializers.DateTimeField(source='created_at', allow_null=True)
    updatedAt = serializers.DateTimeField(source='updated_at', allow_null=True)

    class Meta:
        model = PackageMapping
        fields = ('id','tenantId','ourPackageId','providerApiId','providerPackageId','createdAt','updatedAt')


class PageInfoSerializer(serializers.Serializer):
    nextCursor = serializers.CharField(allow_null=True)
    hasMore = serializers.BooleanField()


class ProvidersListResponseSerializer(serializers.Serializer):
    items = ProviderSerializer(many=True)


class PackageMappingsListResponseSerializer(serializers.Serializer):
    items = PackageMappingSerializer(many=True)
    pageInfo = PageInfoSerializer()


class CoverageItemSerializer(serializers.Serializer):
    packageId = serializers.UUIDField()
    packageName = serializers.CharField(allow_null=True)
    productId = serializers.UUIDField(allow_null=True)
    productName = serializers.CharField(allow_null=True)
    priceGroupId = serializers.UUIDField(allow_null=True)
    priceGroupName = serializers.CharField(allow_null=True)
    routingMode = serializers.CharField(allow_null=True)
    providerType = serializers.CharField(allow_null=True)
    providerId = serializers.CharField(allow_null=True)
    providerName = serializers.CharField(allow_null=True)
    mappingExists = serializers.BooleanField()
    mappedProviderPackageId = serializers.CharField(allow_null=True)
    mappingUpdatedAt = serializers.DateTimeField(allow_null=True)
    costExists = serializers.BooleanField()
    costCurrency = serializers.CharField(allow_null=True)
    costAmount = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)


class CoverageResponseSerializer(serializers.Serializer):
    items = CoverageItemSerializer(many=True)


class IntegrationSerializer(serializers.ModelSerializer):
    tenantId = serializers.UUIDField(source='tenant_id')
    baseUrl = serializers.CharField(source='base_url', allow_null=True, required=False)
    apiToken = serializers.CharField(source='api_token', allow_null=True, required=False)
    balanceUpdatedAt = serializers.DateTimeField(source='balance_updated_at', allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at')

    class Meta:
        model = Integration
        fields = ('id','tenantId','name','provider','scope','baseUrl','apiToken','kod','sifre','enabled','balance','balanceUpdatedAt','createdAt')


class IntegrationCreateRequest(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    provider = serializers.ChoiceField(choices=['barakat','apstore','znet','internal'])
    scope = serializers.ChoiceField(choices=['dev','tenant'], default='tenant')
    baseUrl = serializers.CharField(allow_null=True, required=False)
    apiToken = serializers.CharField(allow_null=True, required=False)
    kod = serializers.CharField(allow_null=True, required=False)
    sifre = serializers.CharField(allow_null=True, required=False)
    enabled = serializers.BooleanField(default=True)


class IntegrationUpdateRequest(serializers.Serializer):
    baseUrl = serializers.CharField(allow_null=True, required=False)
    apiToken = serializers.CharField(allow_null=True, required=False)
    kod = serializers.CharField(allow_null=True, required=False)
    sifre = serializers.CharField(allow_null=True, required=False)
    enabled = serializers.BooleanField(required=False)


class PackageRoutingSerializer(serializers.ModelSerializer):
    tenantId = serializers.UUIDField(source='tenant_id')
    packageId = serializers.UUIDField(source='package_id')
    providerType = serializers.CharField(source='provider_type')
    primaryProviderId = serializers.CharField(source='primary_provider_id', allow_null=True)
    fallbackProviderId = serializers.CharField(source='fallback_provider_id', allow_null=True)
    codeGroupId = serializers.UUIDField(source='code_group_id', allow_null=True)

    class Meta:
        model = PackageRouting
        fields = ('id','tenantId','packageId','mode','providerType','primaryProviderId','fallbackProviderId','codeGroupId')


class PackageRoutingUpsertRequest(serializers.Serializer):
    mode = serializers.ChoiceField(choices=['manual','auto'])
    providerType = serializers.ChoiceField(choices=['manual','external','internal_codes'])
    primaryProviderId = serializers.CharField(allow_null=True, required=False)
    fallbackProviderId = serializers.CharField(allow_null=True, required=False)
    codeGroupId = serializers.UUIDField(allow_null=True, required=False)


class PackageCostSerializer(serializers.ModelSerializer):
    tenantId = serializers.UUIDField(source='tenant_id')
    packageId = serializers.UUIDField(source='package_id')
    providerId = serializers.CharField(source='provider_id')
    costCurrency = serializers.CharField(source='cost_currency')
    costAmount = serializers.DecimalField(source='cost_amount', max_digits=10, decimal_places=2)

    class Meta:
        model = PackageCost
        fields = ('id','tenantId','packageId','providerId','costCurrency','costAmount')


class PackageCostUpsertRequest(serializers.Serializer):
    providerId = serializers.CharField()
    costCurrency = serializers.CharField()
    costAmount = serializers.DecimalField(max_digits=10, decimal_places=2)