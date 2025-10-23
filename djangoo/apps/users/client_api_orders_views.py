"""
Client API Orders Views - for inter-tenant order placement
Allows one tenant to place orders on another tenant via API token
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils.module_loading import import_string
from types import SimpleNamespace
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Optional
from apps.users.models import User
from apps.users.legacy_models import LegacyUser
from apps.products.models import ProductPackage, PackagePrice
from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch_async
from apps.currencies.models import Currency
import logging
import json

logger = logging.getLogger(__name__)


def _normalize_chain_path(raw_path):
    """Return list of order ID strings from stored chain_path value."""
    if not raw_path:
        return []

    if isinstance(raw_path, list):
        return [str(item) for item in raw_path if item]

    if isinstance(raw_path, str):
        cleaned = raw_path.strip()
        if not cleaned:
            return []

        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, list):
                return [str(item) for item in parsed if item]
        except json.JSONDecodeError:
            pass

        if cleaned.startswith('[') and cleaned.endswith(']'):
            cleaned = cleaned[1:-1]

        items: list[str] = []
        for piece in cleaned.split(','):
            piece = piece.strip().strip("'\"")
            if piece:
                items.append(piece)
        return items

    return []


def _set_order_manual(order_obj: ProductOrder, note_text: str, *, log_prefix: str = "[AUTO→MANUAL]") -> None:
    """Force order into manual mode and append a note."""
    if not order_obj:
        return

    try:
        notes = order_obj.notes or []
        if not isinstance(notes, list):
            notes = [str(notes)] if notes else []

        full_note = f"{log_prefix} {note_text}" if note_text else log_prefix
        notes.append(full_note)

        order_obj.notes = notes
        order_obj.notes_count = len(notes)
        order_obj.status = 'pending'
        order_obj.external_status = 'manual_required'
        order_obj.provider_id = None
        order_obj.mode = 'MANUAL'
        order_obj.provider_message = note_text
        order_obj.last_message = note_text
        order_obj.save(update_fields=[
            'notes',
            'notes_count',
            'status',
            'external_status',
            'provider_id',
            'mode',
            'provider_message',
            'last_message',
        ])
    except Exception as exc:
        logger.warning(
            'Failed to switch order to manual mode',
            extra={'order_id': str(getattr(order_obj, 'id', 'unknown')), 'error': str(exc)}
        )


def _order_is_manual(order_obj: ProductOrder | None) -> bool:
    if not order_obj:
        return False

    provider_flag = (getattr(order_obj, 'provider_id', None) or '').strip().upper()
    external_status = (getattr(order_obj, 'external_status', '') or '').lower()
    status = (getattr(order_obj, 'status', '') or '').lower()

    if provider_flag in ('', 'MANUAL', None) and external_status == 'manual_required':
        return True

    if status == 'pending' and provider_flag in ('', 'MANUAL', None) and external_status in ('manual_required', 'not_sent'):
        return True

    return False


class ClientApiAuthMixin:
    """
    Mixin for authenticating Client API requests.
    Checks for 'api-token' header and validates it.
    """

    def authenticate_client_api(self, request):
        """Authenticate using api-token header."""
        api_token = request.headers.get('api-token')

        if not api_token:
            return None, None

        try:
            user = User.objects.get(
                api_token=api_token,
                api_enabled=True,
                api_token_revoked=False,
            )
        except User.DoesNotExist:
            return None, None

        if not user.tenant_id:
            logger.warning('Client API authentication failed: user has no tenant_id')
            return None, None

        request_tenant = getattr(request, 'tenant', None)
        resolved_tenant_id = getattr(request_tenant, 'id', None)
        if resolved_tenant_id and str(resolved_tenant_id) != str(user.tenant_id):
            logger.warning(
                'Client API authentication failed: token tenant mismatch (token=%s, host=%s)',
                user.tenant_id,
                resolved_tenant_id,
            )
            return None, None

        tenant_slug = None
        try:
            LegacyTenant = import_string('apps.tenants.models.Tenant')
            legacy_obj = LegacyTenant.objects.filter(id=user.tenant_id).only('code', 'name').first()
            if legacy_obj:
                tenant_slug = getattr(legacy_obj, 'code', None) or getattr(legacy_obj, 'name', None)
        except Exception:
            tenant_slug = None

        tenant = SimpleNamespace(id=user.tenant_id, slug=tenant_slug or str(user.tenant_id))
        return tenant, user

    def get_legacy_user(self, tenant_id, user) -> Optional[LegacyUser]:
        legacy_user = LegacyUser.objects.filter(
            tenant_id=tenant_id,
            username=user.username,
        ).first()

        if legacy_user or not user.email:
            return legacy_user

        return LegacyUser.objects.filter(
            tenant_id=tenant_id,
            email=user.email,
        ).first()


class ClientApiNewOrderView(ClientApiAuthMixin, APIView):
    """
    POST /client/api/newOrder/:packageId/params
    
    Creates a new order for the authenticated tenant
    Query params: qty, user_identifier, extra_field, order_uuid
    """
    authentication_classes = []  # We handle auth manually
    permission_classes = []  # We handle auth manually
    
    def post(self, request, package_id):
        # Authenticate
        tenant, user = self.authenticate_client_api(request)
        
        if not tenant or not user:
            return Response(
                {'error': 'UNAUTHORIZED', 'message': 'Invalid or missing API token'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get query parameters
        qty = request.GET.get('qty', '1')
        user_identifier = request.GET.get('user_identifier', '')
        extra_field = request.GET.get('extra_field', '')
        order_uuid = request.GET.get('order_uuid')
        
        try:
            quantity = int(qty)
        except (ValueError, TypeError):
            quantity = 1

        if quantity <= 0:
            return Response(
                {'error': 'INVALID_QUANTITY', 'message': 'الكمية يجب أن تكون أكبر من صفر'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        
        # Find package
        try:
            package = ProductPackage.objects.select_related('product').get(
                id=package_id,
                tenant_id=tenant.id,
            )
        except ProductPackage.DoesNotExist:
            return Response(
                {'error': 'NOT_FOUND', 'message': 'Package not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        legacy_user = self.get_legacy_user(tenant.id, user)

        # Create order
        try:
            from django.utils import timezone
            import uuid
            
            with transaction.atomic():
                if not legacy_user:
                    logger.error(
                        'Client API order creation failed: no LegacyUser for tenant=%s user=%s',
                        tenant.id,
                        user.username,
                    )
                    return Response(
                        {'error': 'LEGACY_USER_NOT_FOUND', 'message': 'Legacy user not found for API token'},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    )

                legacy_user_locked = LegacyUser.objects.select_for_update().get(
                    id=legacy_user.id,
                    tenant_id=tenant.id,
                )

                try:
                    django_user_locked = User.objects.select_for_update().get(id=user.id)
                except User.DoesNotExist:
                    django_user_locked = None

                price_group_id = None
                if getattr(legacy_user_locked, 'price_group_id', None):
                    price_group_id = legacy_user_locked.price_group_id
                elif getattr(user, 'price_group_id', None):
                    price_group_id = user.price_group_id

                # Pull effective unit price in USD (fallback to base price)
                price_qs = PackagePrice.objects.filter(
                    tenant_id=tenant.id,
                    package_id=package.id,
                )
                price_row = None
                if price_group_id:
                    price_row = price_qs.filter(price_group_id=price_group_id).first()
                if price_row is None:
                    price_row = price_qs.first()

                unit_price_candidate = None
                if price_row is not None:
                    unit_price_candidate = getattr(price_row, 'price', None)

                if unit_price_candidate is None:
                    unit_price_candidate = package.base_price or package.capital or 0

                try:
                    unit_price_usd = Decimal(unit_price_candidate)
                except (TypeError, ValueError, InvalidOperation):
                    unit_price_usd = Decimal('0')

                price_quant = Decimal('0.0001')
                try:
                    unit_price_usd = unit_price_usd.quantize(price_quant, ROUND_HALF_UP)
                except (InvalidOperation, AttributeError):
                    unit_price_usd = Decimal('0')

                if unit_price_usd <= 0:
                    return Response(
                        {'error': 'PRICE_UNAVAILABLE', 'message': 'السعر غير متاح لهذه الباقة'},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    )

                quantity_dec = Decimal(quantity)
                total_usd = (unit_price_usd * quantity_dec).quantize(price_quant, ROUND_HALF_UP)

                # Resolve wallet currency and rate
                currency_code = (getattr(legacy_user_locked, 'preferred_currency_code', '') or '').strip().upper()
                currency_row = None
                if getattr(legacy_user_locked, 'currency_id', None):
                    currency_row = Currency.objects.filter(
                        tenant_id=tenant.id,
                        id=legacy_user_locked.currency_id,
                    ).first()
                if currency_row is None and currency_code:
                    currency_row = Currency.objects.filter(
                        tenant_id=tenant.id,
                        code__iexact=currency_code,
                    ).first()
                if currency_row:
                    currency_code = (currency_row.code or currency_code or 'USD').upper()
                    rate_raw = currency_row.rate or 1
                else:
                    rate_raw = 1

                try:
                    currency_rate = Decimal(rate_raw)
                except (TypeError, ValueError, InvalidOperation):
                    currency_rate = Decimal('1')
                if currency_rate <= 0:
                    currency_rate = Decimal('1')

                total_user = (total_usd * currency_rate).quantize(Decimal('0.01'), ROUND_HALF_UP)
                unit_price_user = (total_user / quantity_dec).quantize(Decimal('0.01'), ROUND_HALF_UP)

                legacy_balance = Decimal(legacy_user_locked.balance or 0)
                overdraft_legacy = Decimal(getattr(legacy_user_locked, 'overdraft_limit', 0) or 0)
                proposed_legacy_balance = (legacy_balance - total_user).quantize(Decimal('0.01'), ROUND_HALF_UP)
                if proposed_legacy_balance < -overdraft_legacy:
                    return Response(
                        {'error': 'INSUFFICIENT_FUNDS', 'message': 'الرصيد غير كافٍ لدى المستخدم'},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    )

                if django_user_locked is not None:
                    django_balance = Decimal(django_user_locked.balance or 0)
                    overdraft_django = Decimal(getattr(django_user_locked, 'overdraft', 0) or 0)
                    total_user_dj = total_user.quantize(Decimal('0.000001'), ROUND_HALF_UP)
                    proposed_django_balance = (django_balance - total_user_dj).quantize(Decimal('0.000001'), ROUND_HALF_UP)
                    if proposed_django_balance < -overdraft_django:
                        return Response(
                            {'error': 'INSUFFICIENT_FUNDS', 'message': 'الرصيد غير كافٍ لدى الحساب'},
                            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        )
                else:
                    proposed_django_balance = None

                # Apply balance deductions
                legacy_user_locked.balance = proposed_legacy_balance
                legacy_user_locked.save(update_fields=['balance'])

                if django_user_locked is not None:
                    django_user_locked.balance = proposed_django_balance
                    django_user_locked.save(update_fields=['balance'])
                    try:
                        user.balance = django_user_locked.balance
                    except Exception:
                        pass

                # Build chain_path for the new order
                parent_order_id = order_uuid  # The order_uuid is the parent order ID from another tenant
                parent_chain_ids: list[str] = []
                parent_order_obj = None
                new_chain_path = []
                if parent_order_id:
                    try:
                        parent_order = parent_order_obj or ProductOrder.objects.filter(id=parent_order_id).first()
                        if parent_order and str(parent_order.tenant_id) != str(tenant.id):
                            # Inherit chain_path from parent and add parent to it
                            if not parent_chain_ids:
                                for oid in _normalize_chain_path(parent_order.chain_path):
                                    prev_order = ProductOrder.objects.filter(id=oid).first()
                                    if prev_order and not _order_is_manual(prev_order):
                                        parent_chain_ids.append(str(prev_order.id))
                            new_chain_path = parent_chain_ids + [str(parent_order.id)]
                    except Exception:
                        pass

                # Determine provider_id for the new order (for API column display)
                # Get the routing configuration to see what provider this order will use
                order_provider_id = None
                try:
                    from apps.providers.models import PackageRouting
                    routing = PackageRouting.objects.filter(
                        tenant_id=tenant.id,
                        package_id=package.id
                    ).first()
                    if routing:
                        order_provider_id = routing.primary_provider_id
                except Exception:
                    pass

                order = ProductOrder.objects.create(
                    id=uuid.uuid4(),
                    tenant_id=tenant.id,
                    user_id=legacy_user_locked.id,
                    product_id=package.product_id,
                    package_id=package.id,
                    quantity=quantity,
                    user_identifier=user_identifier or '',
                    extra_field=extra_field or '',
                    status='pending',
                    sell_price_amount=total_user,
                    price=total_usd,
                    external_status='not_sent',
                    sell_price_currency=currency_code or 'USD',
                    external_order_id=order_uuid or None,
                    provider_referans=order_uuid or None,
                    provider_id=order_provider_id,  # Set provider from routing
                    created_at=timezone.now(),
                    notes=[],
                    notes_count=0,
                    chain_path=json.dumps(new_chain_path) if new_chain_path else None,
                )
                
                # CHAIN FORWARDING COST CALCULATION: Compute cost for intermediate tenant before forwarding
                try:
                    from apps.orders.services import _compute_manual_cost_snapshot, _persist_cost_snapshot
                    from django.conf import settings
                    import json
                    
                    if getattr(settings, 'FF_USD_COST_ENFORCEMENT', False):
                        print(f"💰 Computing intermediate cost for chain forwarding (Client API)...")
                        cost_snapshot = _compute_manual_cost_snapshot(order)
                        _persist_cost_snapshot(
                            order_id=order.id,
                            snapshot=cost_snapshot,
                            quantity=order.quantity or 1,
                            tenant_id=order.tenant_id,
                            mode='MANUAL',
                        )
                        print(f"✅ Intermediate cost computed: {cost_snapshot.cost_price_usd} USD")
                        
                        # Keep chain_path as order ID history only; no additional writes here
                        pass
                except Exception as exc:
                    print(f"⚠️ Failed to compute intermediate cost for chain forwarding: {exc}")
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(
                        "Failed to compute intermediate cost for chain forwarding (Client API)",
                        extra={"order_id": str(order.id), "error": str(exc)}
                    )

                order_id_for_dispatch = str(order.id)
                tenant_id_for_dispatch = str(tenant.id)

                def _schedule_auto_dispatch() -> None:
                    try:
                        result = try_auto_dispatch_async(order_id_for_dispatch, tenant_id_for_dispatch)
                        if not result.get('dispatched'):
                            logger.info(
                                'Client API auto-dispatch skipped',
                                extra={
                                    'order_id': order_id_for_dispatch,
                                    'reason': result.get('reason') or result.get('error'),
                                },
                            )
                    except Exception:
                        logger.exception('Client API auto-dispatch failed', extra={'order_id': order_id_for_dispatch})

                transaction.on_commit(_schedule_auto_dispatch)
                
                logger.info(f'✅ Client API order created: {order.id} for tenant {tenant.slug}')
                
                response_payload = {
                    'orderId': str(order.id),
                    'status': order.status,
                    'createdAt': order.created_at.isoformat() if order.created_at else None,
                    'priceUSD': str(unit_price_usd),
                    'totalPriceUSD': str(total_usd),
                    'sellPriceAmount': str(total_user),
                    'sellPriceCurrency': currency_code or 'USD',
                    'priceCurrency': currency_code or 'USD',
                    'priceGroupId': str(price_group_id) if price_group_id else None,
                    'walletBalance': str(proposed_legacy_balance),
                    'walletCurrency': currency_code or 'USD',
                    'unitPriceWallet': str(unit_price_user),
                }

                return Response(response_payload, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            logger.exception(f'Failed to create Client API order')
            return Response(
                {'error': 'SERVER_ERROR', 'message': str(e)[:200]},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ClientApiCheckOrderView(ClientApiAuthMixin, APIView):
    """
    GET /client/api/check?orders=ID1,ID2&uuid=1
    
    Check order status
    """
    authentication_classes = []
    permission_classes = []
    
    def get(self, request):
        # Authenticate
        tenant, user = self.authenticate_client_api(request)
        
        if not tenant or not user:
            return Response(
                {'error': 'UNAUTHORIZED', 'message': 'Invalid or missing API token'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get order IDs
        orders_param = request.GET.get('orders', '')
        uuid_flag = request.GET.get('uuid', '0')
        by_uuid = uuid_flag == '1'
        
        order_ids = [x.strip() for x in orders_param.split(',') if x.strip()][:50]
        
        legacy_user = self.get_legacy_user(tenant.id, user)
        results = []
        for order_id in order_ids:
            try:
                filters = {
                    'tenant_id': tenant.id,
                }

                if legacy_user:
                    filters['user_id'] = legacy_user.id

                if by_uuid:
                    filters['external_order_id'] = order_id
                else:
                    filters['id'] = order_id

                order = ProductOrder.objects.get(**filters)
                
                results.append({
                    'orderId': str(order.id),
                    'status': order.status,
                    'quantity': order.quantity,
                    'pin': getattr(order, 'pin_code', None) or '',
                    'note': (getattr(order, 'provider_message', None) or getattr(order, 'last_message', None) or ''),
                    'externalStatus': getattr(order, 'external_status', ''),
                    'externalOrderId': getattr(order, 'external_order_id', ''),
                    'providerReferans': getattr(order, 'provider_referans', ''),
                    'createdAt': order.created_at.isoformat() if order.created_at else None,
                })
                
            except ProductOrder.DoesNotExist:
                pass
        
        return Response(results, status=status.HTTP_200_OK)
