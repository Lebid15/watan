from __future__ import annotations

from rest_framework import serializers
from .models import TenantApiToken


class TenantApiTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantApiToken
        fields = [
            'id','tenant_id','user_id','name','token_prefix','scopes','expires_at','last_used_at','is_active','created_at'
        ]


class CreateTokenRequest(serializers.Serializer):
    name = serializers.CharField(max_length=80, required=False, allow_null=True)
    user_id = serializers.UUIDField()
    scopes = serializers.ListField(child=serializers.CharField(max_length=60), allow_empty=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class RotateTokenRequest(serializers.Serializer):
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)
