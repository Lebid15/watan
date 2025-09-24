from rest_framework import serializers
from .models import CodeGroup, CodeItem


class CodeGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeGroup
        fields = ['id', 'name', 'public_code', 'note', 'provider_type', 'is_active', 'created_at', 'updated_at']


class CodeItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeItem
        fields = ['id', 'pin', 'serial', 'cost', 'status', 'order_id', 'created_at', 'used_at']
