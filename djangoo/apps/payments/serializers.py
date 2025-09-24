from __future__ import annotations

from rest_framework import serializers
from .models import PaymentMethod, Deposit


class PaymentMethodSerializer(serializers.ModelSerializer):
    isActive = serializers.BooleanField(source='is_active')
    createdAt = serializers.DateTimeField(source='created_at', allow_null=True)
    updatedAt = serializers.DateTimeField(source='updated_at', allow_null=True)

    class Meta:
        model = PaymentMethod
        fields = ('id', 'name', 'type', 'isActive', 'config', 'logo_url', 'note', 'createdAt', 'updatedAt')


class AdminPaymentMethodSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    type = serializers.ChoiceField(choices=['CASH_BOX','BANK_ACCOUNT','HAND_DELIVERY','USDT','MONEY_TRANSFER'])
    logoUrl = serializers.CharField(allow_null=True, required=False)
    note = serializers.CharField(allow_null=True, required=False)
    isActive = serializers.BooleanField()
    config = serializers.DictField(allow_empty=True)
    createdAt = serializers.DateTimeField(allow_null=True)

    @staticmethod
    def from_model(obj: PaymentMethod):
        return {
            'id': obj.id,
            'name': obj.name,
            'type': obj.type or 'CASH_BOX',
            'logoUrl': getattr(obj, 'logo_url', None),
            'note': getattr(obj, 'note', None),
            'isActive': bool(getattr(obj, 'is_active', False)),
            'config': getattr(obj, 'config', {}) or {},
            'createdAt': getattr(obj, 'created_at', None),
        }


class AdminPaymentMethodUpsertSerializer(serializers.Serializer):
    name = serializers.CharField()
    type = serializers.ChoiceField(choices=['CASH_BOX','BANK_ACCOUNT','HAND_DELIVERY','USDT','MONEY_TRANSFER'])
    isActive = serializers.BooleanField(required=False)
    logoUrl = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    config = serializers.DictField(required=False)


class DepositListItemSerializer(serializers.ModelSerializer):
    userId = serializers.UUIDField(source='user_id')
    methodId = serializers.UUIDField(source='method_id', allow_null=True)
    originalAmount = serializers.DecimalField(source='original_amount', max_digits=18, decimal_places=8)
    originalCurrency = serializers.CharField(source='original_currency')
    walletCurrency = serializers.CharField(source='wallet_currency')
    rateUsed = serializers.DecimalField(source='rate_used', max_digits=18, decimal_places=8)
    convertedAmount = serializers.DecimalField(source='converted_amount', max_digits=18, decimal_places=8)
    createdAt = serializers.DateTimeField(source='created_at')

    class Meta:
        model = Deposit
        fields = (
            'id','status','originalAmount','originalCurrency','walletCurrency','rateUsed','convertedAmount','userId','methodId','note','createdAt'
        )


class AdminDepositListItemSerializer(DepositListItemSerializer):
    class Meta(DepositListItemSerializer.Meta):
        fields = DepositListItemSerializer.Meta.fields


class DepositDetailsSerializer(DepositListItemSerializer):
    class Meta(DepositListItemSerializer.Meta):
        fields = DepositListItemSerializer.Meta.fields


# OpenAPI helper serializers
class PageInfoSerializer(serializers.Serializer):
    nextCursor = serializers.CharField(allow_null=True)
    hasMore = serializers.BooleanField()


class DepositsListResponseSerializer(serializers.Serializer):
    items = DepositListItemSerializer(many=True)
    pageInfo = PageInfoSerializer()


class AdminDepositsListResponseSerializer(serializers.Serializer):
    items = AdminDepositListItemSerializer(many=True)
    pageInfo = PageInfoSerializer()


class AdminDepositActionRequestSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['approved','rejected'])
    note = serializers.CharField(required=False, allow_blank=True)


class AdminDepositActionResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    id = serializers.UUIDField()
    status = serializers.CharField()


class AdminDepositNotesResponseSerializer(serializers.Serializer):
    depositId = serializers.UUIDField()
    notes = serializers.ListField(child=serializers.DictField(), allow_empty=True)