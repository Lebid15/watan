from rest_framework import serializers
from apps.users.wallet_models import WalletTransaction


class WalletTransactionSerializer(serializers.ModelSerializer):
    """
    Serializer لعرض معاملات المحفظة
    """
    transaction_type_display = serializers.CharField(
        source='get_transaction_type_display',
        read_only=True
    )
    
    class Meta:
        model = WalletTransaction
        fields = [
            'id',
            'transaction_type',
            'transaction_type_display',
            'amount',
            'currency',
            'balance_before',
            'balance_after',
            'description',
            'order_id',
            'metadata',
            'created_at',
        ]
        read_only_fields = fields


class WalletTransactionsListResponseSerializer(serializers.Serializer):
    """
    Response للقائمة مع pagination
    """
    transactions = WalletTransactionSerializer(many=True)
    total = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
