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
    imageUrl = serializers.SerializerMethodField()
    
    def get_imageUrl(self, obj):
        """Pick image from multiple possible fields (like NestJS pickImage) - for Product"""
        if not obj:
            return None
        
        # Get the raw image path
        raw_image = (
            getattr(obj, 'custom_image_url', None) or
            getattr(obj, 'thumb_medium_url', None) or
            getattr(obj, 'thumb_small_url', None) or
            getattr(obj, 'thumb_large_url', None) or
            getattr(obj, 'image_url', None) or
            getattr(obj, 'image', None) or
            getattr(obj, 'logo_url', None) or
            getattr(obj, 'icon_url', None) or
            getattr(obj, 'icon', None) or
            None
        )
        
        if not raw_image:
            return None
        
        # If it's already a full URL, return as is
        if raw_image.startswith('http://') or raw_image.startswith('https://'):
            return raw_image
        
        # For relative paths, return as-is and let frontend resolve them
        # Frontend will use its apiHost or window.location.origin
        return raw_image


class _PackageMiniSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(allow_null=True)
    productId = serializers.SerializerMethodField()
    imageUrl = serializers.SerializerMethodField()

    def get_productId(self, obj):
        return getattr(obj, 'product_id', None)
    
    def get_imageUrl(self, obj):
        """Pick image from multiple possible fields (like NestJS pickImage) - for Package"""
        if not obj:
            return None
        
        # Get the raw image path
        raw_image = (
            getattr(obj, 'image_url', None) or
            getattr(obj, 'image', None) or
            getattr(obj, 'logo_url', None) or
            getattr(obj, 'icon_url', None) or
            getattr(obj, 'icon', None) or
            None
        )
        
        if not raw_image:
            return None
        
        # If it's already a full URL, return as is
        if raw_image.startswith('http://') or raw_image.startswith('https://'):
            return raw_image
        
        # For relative paths, return as-is and let frontend resolve them
        return raw_image


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
        # If order is approved and FX is locked, use frozen values
        if getattr(obj, 'fx_locked', False) and getattr(obj, 'sell_try_at_approval', None) is not None:
            # Use frozen TRY values
            total_try = float(obj.sell_try_at_approval)
            unit_try = None
            if obj.quantity and obj.quantity > 0:
                try:
                    unit_try = total_try / float(obj.quantity)
                except Exception:
                    pass
            return {
                'currencyCode': 'TRY',
                'totalPrice': total_try,
                'unitPrice': unit_try,
            }
        
        # Otherwise, use current calculation (for pending/rejected orders)
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
        """Get cost in TRY - use FROZEN snapshot, never recalculate!"""
        # ✅ PRIORITY 1: Use frozen cost_try_at_order (set at order creation time)
        if hasattr(obj, 'cost_try_at_order') and obj.cost_try_at_order is not None:
            return float(obj.cost_try_at_order)
        
        # ✅ PRIORITY 2: If FX is locked (approved orders), use cost_try_at_approval
        if getattr(obj, 'fx_locked', False) and getattr(obj, 'cost_try_at_approval', None) is not None:
            return float(obj.cost_try_at_approval)
        
        # ❌ FALLBACK (only for old orders): Calculate from cost_usd_at_order
        if hasattr(obj, 'cost_usd_at_order') and obj.cost_usd_at_order is not None:
            from apps.currencies.models import Currency
            from decimal import Decimal
            
            try:
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
                cost_usd = Decimal(str(obj.cost_usd_at_order))
                total_cost_try = cost_usd * exchange_rate
                
                return float(total_cost_try)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error converting cost USD to TRY for order {obj.id}: {e}")
        
        # ❌ OLD FALLBACK: Calculate from package capital (less accurate)
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
        """Get sell price in TRY - use FROZEN snapshot, never recalculate!"""
        # ✅ PRIORITY 1: Use frozen sell_try_at_order (set at order creation time)
        if hasattr(obj, 'sell_try_at_order') and obj.sell_try_at_order is not None:
            return float(obj.sell_try_at_order)
        
        # ✅ PRIORITY 2: If FX is locked (approved orders), use sell_try_at_approval
        if getattr(obj, 'fx_locked', False) and getattr(obj, 'sell_try_at_approval', None) is not None:
            return float(obj.sell_try_at_approval)
        
        # ❌ FALLBACK (only for old orders): Calculate from sell_usd_at_order
        if hasattr(obj, 'sell_usd_at_order') and obj.sell_usd_at_order is not None:
            from apps.currencies.models import Currency
            from decimal import Decimal
            
            try:
                currency = Currency.objects.filter(
                    tenant_id=obj.tenant_id,
                    code__iexact='TRY',
                    is_active=True
                ).first()
                
                exchange_rate = Decimal('1')
                if currency and currency.rate:
                    exchange_rate = Decimal(str(currency.rate))
                
                sell_usd = Decimal(str(obj.sell_usd_at_order))
                sell_try = sell_usd * exchange_rate
                return float(sell_try)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error converting sell USD to TRY for order {obj.id}: {e}")
        
        # ❌ OLD FALLBACK: Calculate from current exchange rates
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
        """Get profit in TRY - use FROZEN snapshot, never recalculate!"""
        # ✅ PRIORITY 1: Use frozen profit_try_at_order (set at order creation time)
        if hasattr(obj, 'profit_try_at_order') and obj.profit_try_at_order is not None:
            return float(obj.profit_try_at_order)
        
        # ✅ PRIORITY 2: If FX is locked (approved orders), use profit_try_at_approval
        if getattr(obj, 'fx_locked', False) and getattr(obj, 'profit_try_at_approval', None) is not None:
            return float(obj.profit_try_at_approval)
        
        # ❌ FALLBACK (only for old orders): Calculate from profit_usd_at_order
        if hasattr(obj, 'profit_usd_at_order') and obj.profit_usd_at_order is not None:
            from apps.currencies.models import Currency
            from decimal import Decimal
            
            try:
                currency = Currency.objects.filter(
                    tenant_id=obj.tenant_id,
                    code__iexact='TRY',
                    is_active=True
                ).first()
                
                exchange_rate = Decimal('1')
                if currency and currency.rate:
                    exchange_rate = Decimal(str(currency.rate))
                
                profit_usd = Decimal(str(obj.profit_usd_at_order))
                profit_try = profit_usd * exchange_rate
                return float(profit_try)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error converting profit USD to TRY for order {obj.id}: {e}")
        
        # ❌ OLD FALLBACK: Calculate from current cost and sell
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
        """Get cost in USD - use pre-calculated value from database (with currency conversion)"""
        # ✅ NEW: Read from cost_usd_at_order column (calculated immediately after dispatch)
        if hasattr(obj, 'cost_usd_at_order') and obj.cost_usd_at_order is not None:
            return float(obj.cost_usd_at_order)
        
        # ❌ OLD FALLBACK: Calculate from package capital (not accurate for external providers!)
        # This is only used for old orders before the column was added
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
        """Get sell price in USD - use pre-calculated snapshot"""
        # ✅ NEW: Read from sell_usd_at_order column (calculated immediately after dispatch)
        if hasattr(obj, 'sell_usd_at_order') and obj.sell_usd_at_order is not None:
            return float(obj.sell_usd_at_order)
        
        # ❌ OLD FALLBACK: Use price field
        # The 'price' field is always stored in USD at order creation time
        # Do NOT convert from TRY as that would use current exchange rate
        if obj.price:
            return float(obj.price)
        
        # Fallback: if sell_price is in USD
        if obj.sell_price_currency == 'USD' and obj.sell_price_amount:
            return float(obj.sell_price_amount)
        
        return None

    def get_profitUsdAtOrder(self, obj):
        """Calculate profit in USD - use pre-calculated snapshot"""
        # ✅ NEW: Read from profit_usd_at_order column (calculated immediately after dispatch)
        if hasattr(obj, 'profit_usd_at_order') and obj.profit_usd_at_order is not None:
            return float(obj.profit_usd_at_order)
        
        # ❌ OLD FALLBACK: Calculate on the fly
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
