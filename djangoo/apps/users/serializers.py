from rest_framework import serializers
from .models import User
from .legacy_models import LegacyUser


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "balance",
            "currency",
            "status",
            "overdraft",
            "role",
        ]


class UserProfileWithCurrencySerializer(UserProfileSerializer):
    currency_code = serializers.CharField(source="currency")

    class Meta(UserProfileSerializer.Meta):
        fields = UserProfileSerializer.Meta.fields + ["currency_code"]


class LegacyUserListSerializer(serializers.ModelSerializer):
    roleFinal = serializers.SerializerMethodField()

    class Meta:
        model = LegacyUser
        fields = [
            'id', 'email', 'username', 'roleFinal', 'balance', 'preferred_currency_code',
        ]

    def get_roleFinal(self, obj):
        # normalize role to lower-case string for UI
        if obj.role:
            return str(obj.role).lower()
        return None


class LegacyUserWithPriceGroupSerializer(LegacyUserListSerializer):
    priceGroup = serializers.SerializerMethodField()

    class Meta(LegacyUserListSerializer.Meta):
        fields = LegacyUserListSerializer.Meta.fields + ['priceGroup']

    def get_priceGroup(self, obj):
        if getattr(obj, 'price_group_id', None):
            return { 'id': obj.price_group_id }
        return None
