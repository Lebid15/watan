from __future__ import annotations

from rest_framework import serializers
from .models import Tenant, TenantDomain


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = [
            'id','name','code','owner_user_id','is_active','created_at','updated_at','deleted_at'
        ]


class TenantCreateRequest(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    code = serializers.CharField(max_length=40)
    owner_user_id = serializers.UUIDField(required=False, allow_null=True)
    is_active = serializers.BooleanField(default=True)


class TenantUpdateRequest(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    code = serializers.CharField(max_length=40, required=False)
    owner_user_id = serializers.UUIDField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)


class TenantDomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantDomain
        fields = [
            'id','tenant_id','domain','type','is_primary','is_verified','created_at','updated_at','deleted_at'
        ]


class DomainCreateRequest(serializers.Serializer):
    domain = serializers.CharField(max_length=190)
    type = serializers.CharField(max_length=20, required=False)
    is_primary = serializers.BooleanField(default=False)


class DomainUpdateRequest(serializers.Serializer):
    domain = serializers.CharField(max_length=190, required=False)
    type = serializers.CharField(max_length=20, required=False)
    is_primary = serializers.BooleanField(required=False)
    is_verified = serializers.BooleanField(required=False)
