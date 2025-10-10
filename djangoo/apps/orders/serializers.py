from __future__ import annotations

from rest_framework import serializers
from .models import ProductOrder


class OrderCreateRequestSerializer(serializers.Serializer):
    productId = serializers.UUIDField()
    packageId = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, default=1)
    userIdentifier = serializers.CharField(required=False, allow_blank=True)
    extraField = serializers.CharField(required=False, allow_blank=True)


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
        if hasattr(obj, 'unit_price_applied') and obj.unit_price_applied is not None:
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
        sell_amount = getattr(obj, 'sell_price_amount', None)
        if sell_amount in (None, '') and hasattr(obj, 'sell_price_amount_value'):
            sell_amount = getattr(obj, 'sell_price_amount_value', None)
        total = sell_amount or obj.price
        try:
            total_f = float(total) if total is not None else None
        except Exception:
            total_f = None
        unit = self.get_unitPriceUSD(obj)
        if total_f is None and unit is None:
            return None
        return {
            'currencyCode': getattr(obj, 'sell_price_currency', None) or 'USD',
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
    username = serializers.SerializerMethodField()
    userEmail = serializers.SerializerMethodField()
    costTRY = serializers.SerializerMethodField()
    sellTRY = serializers.SerializerMethodField()
    profitTRY = serializers.SerializerMethodField()
    currencyTRY = serializers.SerializerMethodField()
    costUsdAtOrder = serializers.SerializerMethodField()
    sellUsdAtOrder = serializers.SerializerMethodField()
    profitUsdAtOrder = serializers.SerializerMethodField()
    providerId = serializers.CharField(source='provider_id', allow_null=True)
    providerType = serializers.SerializerMethodField()
    externalOrderId = serializers.CharField(source='external_order_id', allow_null=True)

    class Meta:
        model = ProductOrder
        fields = (
            'id', 'orderNo', 'status', 'userIdentifier',
            'createdAt', 'sentAt', 'completedAt', 'durationMs',
            'sellPriceAmount', 'sellPriceCurrency', 'price',
            'providerMessage', 'notesCount', 'manualNote', 'fxLocked',
            'approvedLocalDate', 'product', 'package', 'username', 'userEmail',
            'costTRY', 'sellTRY', 'profitTRY', 'currencyTRY',
            'costUsdAtOrder', 'sellUsdAtOrder', 'profitUsdAtOrder',
            'providerId', 'providerType', 'externalOrderId',
        )

    def get_username(self, obj):
        # Get username from the related user if it exists
        if hasattr(obj, 'user') and obj.user:
            return getattr(obj.user, 'username', None)
        return None

    def get_userEmail(self, obj):
        # Get email from the related user if it exists
        if hasattr(obj, 'user') and obj.user:
            return getattr(obj.user, 'email', None)
        return None

    def get_costTRY(self, obj):
        """Get cost in TRY from package capital/base_price, converting from USD to TRY"""
        if not obj.package_id:
            return None
        
        from apps.currencies.models import Currency
        from apps.products.models import ProductPackage
        from decimal import Decimal
        
        try:
            # Explicitly fetch the package to ensure we have capital/base_price
            package = ProductPackage.objects.filter(id=obj.package_id).first()
            if not package:
                return None
            
            capital_usd = package.capital or package.base_price or Decimal('0')
            
            if capital_usd <= 0:
                return None
            
            capital_usd = Decimal(str(capital_usd))
            quantity = obj.quantity if obj.quantity else 1
            total_cost_usd = capital_usd * quantity
            
            # Get exchange rate from currencies table
            currency = Currency.objects.filter(
                tenant_id=obj.tenant_id,
                code__iexact='TRY',
                is_active=True
            ).first()
            
            exchange_rate = Decimal('1')
            if currency and currency.rate:
                exchange_rate = Decimal(str(currency.rate))
            
            # Convert USD to TRY
            total_cost_try = total_cost_usd * exchange_rate
            
            return float(total_cost_try)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error calculating costTRY for order {obj.id}: {e}")
        
        return None

    def get_sellTRY(self, obj):
        """Get sell price in TRY from user's price group or direct sell_price_amount"""
        from apps.currencies.models import Currency
        from decimal import Decimal
        
        # If sell price is already in TRY, return it directly
        if obj.sell_price_currency == 'TRY':
            return float(obj.sell_price_amount) if obj.sell_price_amount else None
        
        # If sell price is in USD, convert to TRY
        if obj.sell_price_currency == 'USD' and obj.sell_price_amount:
            try:
                currency = Currency.objects.filter(
                    tenant_id=obj.tenant_id,
                    code__iexact='TRY',
                    is_active=True
                ).first()
                
                exchange_rate = Decimal('1')
                if currency and currency.rate:
                    exchange_rate = Decimal(str(currency.rate))
                
                sell_try = Decimal(str(obj.sell_price_amount)) * exchange_rate
                return float(sell_try)
            except Exception:
                pass
        
        return None

    def get_profitTRY(self, obj):
        # Calculate profit if both cost and sell are available
        cost = self.get_costTRY(obj)
        sell = self.get_sellTRY(obj)
        if cost is not None and sell is not None:
            return sell - cost
        return None

    def get_currencyTRY(self, obj):
        # Return 'TRY' if we have any TRY values
        if self.get_costTRY(obj) is not None or self.get_sellTRY(obj) is not None:
            return 'TRY'
        return None

    def get_costUsdAtOrder(self, obj):
        """Get cost in USD from package capital/base_price"""
        if not obj.package_id:
            return None
        
        from apps.products.models import ProductPackage
        from decimal import Decimal
        
        try:
            package = ProductPackage.objects.filter(id=obj.package_id).first()
            if not package:
                return None
            
            capital_usd = package.capital or package.base_price or Decimal('0')
            
            if capital_usd <= 0:
                return None
            
            quantity = obj.quantity if obj.quantity else 1
            total_cost_usd = Decimal(str(capital_usd)) * quantity
            
            return float(total_cost_usd)
        except Exception:
            return None

    def get_sellUsdAtOrder(self, obj):
        """Get sell price in USD"""
        # If already in USD, return it
        if obj.sell_price_currency == 'USD' and obj.sell_price_amount:
            return float(obj.sell_price_amount)
        
        # If in TRY, convert to USD
        if obj.sell_price_currency == 'TRY' and obj.sell_price_amount:
            from apps.currencies.models import Currency
            from decimal import Decimal
            
            try:
                currency = Currency.objects.filter(
                    tenant_id=obj.tenant_id,
                    code__iexact='TRY',
                    is_active=True
                ).first()
                
                if currency and currency.rate and currency.rate > 0:
                    exchange_rate = Decimal(str(currency.rate))
                    sell_usd = Decimal(str(obj.sell_price_amount)) / exchange_rate
                    return float(sell_usd)
            except Exception:
                pass
        
        return None

    def get_profitUsdAtOrder(self, obj):
        """Calculate profit in USD"""
        cost_usd = self.get_costUsdAtOrder(obj)
        sell_usd = self.get_sellUsdAtOrder(obj)
        
        if cost_usd is not None and sell_usd is not None:
            return sell_usd - cost_usd
        
        return None

    def get_providerType(self, obj):
        # Determine provider type based on provider_id and pin_code
        if obj.external_status == 'completed' and obj.pin_code:
            return 'internal_codes'
        elif obj.provider_id:
            return 'external'
        else:
            return 'manual'


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
