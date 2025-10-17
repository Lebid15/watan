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
    payment_method = serializers.SerializerMethodField()
    
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
            'payment_method',
        ]
        read_only_fields = fields

    def get_payment_method(self, obj):
        context_map = self.context.get('payment_methods') or {}
        metadata = getattr(obj, 'metadata', None)

        if isinstance(metadata, dict):
            method_id = metadata.get('method_id') or metadata.get('methodId')
        else:
            method_id = None

        if not method_id:
            return None

        method_id_str = str(method_id)
        method_payload = context_map.get(method_id_str)

        if method_payload:
            return method_payload

        method_name = None
        if isinstance(metadata, dict):
            name_candidate = metadata.get('method_name') or metadata.get('methodName')
            if name_candidate:
                method_name = str(name_candidate)

        return {
            'id': method_id_str,
            'name': method_name,
        }


class WalletTransactionsListResponseSerializer(serializers.Serializer):
    """
    Response للقائمة مع pagination
    """
    transactions = WalletTransactionSerializer(many=True)
    total = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_pages = serializers.IntegerField()
