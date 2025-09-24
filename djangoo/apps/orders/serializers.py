from __future__ import annotations

from rest_framework import serializers
from .models import ProductOrder


class _ProductMiniSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(allow_null=True)


class _PackageMiniSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(allow_null=True)
    productId = serializers.SerializerMethodField()

    def get_productId(self, obj):
        return getattr(obj, 'product_id', None)


class OrderListItemSerializer(serializers.ModelSerializer):
    product = _ProductMiniSerializer(allow_null=True)
    package = _PackageMiniSerializer(allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at')
    userIdentifier = serializers.CharField(source='user_identifier', allow_null=True)
    extraField = serializers.CharField(source='extra_field', allow_null=True)
    orderNo = serializers.IntegerField(source='order_no', allow_null=True)
    priceUSD = serializers.SerializerMethodField()
    unitPriceUSD = serializers.SerializerMethodField()
    display = serializers.SerializerMethodField()

    class Meta:
        model = ProductOrder
        fields = (
            'id', 'status', 'createdAt', 'product', 'package', 'quantity',
            'userIdentifier', 'extraField', 'orderNo', 'priceUSD', 'unitPriceUSD', 'display',
        )

    def get_priceUSD(self, obj: ProductOrder):
        # Prefer sell_price_amount, fallback to price
        v = obj.sell_price_amount or obj.price
        return float(v) if v is not None else None

    def get_unitPriceUSD(self, obj: ProductOrder):
        if obj.unit_price_applied is not None:
            try:
                return float(obj.unit_price_applied)
            except Exception:
                return None
        if obj.price and obj.quantity:
            try:
                return float(obj.price) / float(obj.quantity)
            except Exception:
                return None
        return None

    def get_display(self, obj: ProductOrder):
        total = obj.sell_price_amount or obj.price
        try:
            total_f = float(total) if total is not None else None
        except Exception:
            total_f = None
        unit = self.get_unitPriceUSD(obj)
        if total_f is None and unit is None:
            return None
        return {
            'currencyCode': obj.sell_price_currency or 'USD',
            'totalPrice': total_f or 0,
            'unitPrice': unit,
        }


class AdminOrderListItemSerializer(serializers.ModelSerializer):
    product = _ProductMiniSerializer(allow_null=True)
    package = _PackageMiniSerializer(allow_null=True)
    orderNo = serializers.IntegerField(source='order_no', allow_null=True)
    userIdentifier = serializers.CharField(source='user_identifier', allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at')
    sentAt = serializers.DateTimeField(source='sent_at', allow_null=True)
    completedAt = serializers.DateTimeField(source='completed_at', allow_null=True)
    durationMs = serializers.IntegerField(source='duration_ms', allow_null=True)
    sellPriceAmount = serializers.DecimalField(source='sell_price_amount', max_digits=12, decimal_places=2)
    sellPriceCurrency = serializers.CharField(source='sell_price_currency')
    providerMessage = serializers.CharField(source='provider_message', allow_null=True)
    notesCount = serializers.IntegerField(source='notes_count')
    manualNote = serializers.CharField(source='manual_note', allow_null=True)
    fxLocked = serializers.BooleanField(source='fx_locked')
    approvedLocalDate = serializers.DateField(source='approved_local_date', allow_null=True)

    class Meta:
        model = ProductOrder
        fields = (
            'id', 'orderNo', 'status', 'userIdentifier',
            'createdAt', 'sentAt', 'completedAt', 'durationMs',
            'sellPriceAmount', 'sellPriceCurrency', 'price',
            'providerMessage', 'notesCount', 'manualNote', 'fxLocked',
            'approvedLocalDate', 'product', 'package',
        )


# ---- OpenAPI helper serializers ----

class PageInfoSerializer(serializers.Serializer):
    nextCursor = serializers.CharField(allow_null=True)
    hasMore = serializers.BooleanField()


class OrdersListResponseSerializer(serializers.Serializer):
    items = OrderListItemSerializer(many=True)
    pageInfo = PageInfoSerializer()


class AdminOrdersListResponseSerializer(serializers.Serializer):
    items = AdminOrderListItemSerializer(many=True)
    pageInfo = PageInfoSerializer()


class MyOrderDetailsResponseSerializer(OrderListItemSerializer):
    manualNote = serializers.CharField(allow_null=True)
    notes = serializers.ListField(child=serializers.DictField(), allow_empty=True)
    externalStatus = serializers.CharField(allow_null=True)
    lastMessage = serializers.CharField(allow_null=True)
    providerMessage = serializers.CharField(allow_null=True)
    pinCode = serializers.CharField(allow_null=True)

    class Meta(OrderListItemSerializer.Meta):
        fields = OrderListItemSerializer.Meta.fields + (
            'manualNote','notes','externalStatus','lastMessage','providerMessage','pinCode'
        )


class AdminOrderDetailsPayloadSerializer(AdminOrderListItemSerializer):
    providerId = serializers.IntegerField(source='provider_id', allow_null=True)
    externalOrderId = serializers.CharField(source='external_order_id', allow_null=True)
    externalStatus = serializers.CharField(source='external_status', allow_null=True)
    lastMessage = serializers.CharField(source='last_message', allow_null=True)
    pinCode = serializers.CharField(source='pin_code', allow_null=True)
    notes = serializers.ListField(child=serializers.DictField(), allow_empty=True)

    class Meta(AdminOrderListItemSerializer.Meta):
        fields = AdminOrderListItemSerializer.Meta.fields + (
            'providerId','externalOrderId','externalStatus','lastMessage','pinCode','notes'
        )


class AdminOrderDetailsResponseSerializer(serializers.Serializer):
    order = AdminOrderDetailsPayloadSerializer()


class AdminOrderNotesResponseSerializer(serializers.Serializer):
    orderId = serializers.UUIDField()
    notes = serializers.ListField(child=serializers.DictField(), allow_empty=True)


class AdminOrderStatusUpdateRequestSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['approved','rejected'])
    note = serializers.CharField(required=False, allow_blank=True)


class AdminOrderActionResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    id = serializers.UUIDField()
    status = serializers.CharField()


class AdminOrderSyncExternalResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    order = serializers.DictField()
