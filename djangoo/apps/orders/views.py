from __future__ import annotations

import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

from django.db import transaction
from django.db.models import Q, CharField
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import RequireAdminRole
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from .models import ProductOrder, OrderDispatchLog
from apps.providers.models import PackageRouting, PackageMapping, Integration
from apps.providers.adapters import resolve_adapter_credentials
from django.utils import timezone
from django.db import connection
from django.db.models.functions import Cast
from datetime import datetime
from .serializers import (
    OrderCreateRequestSerializer,
    OrderListItemSerializer,
    AdminOrderListItemSerializer,
    OrdersListResponseSerializer,
    AdminOrdersListResponseSerializer,
    MyOrderDetailsResponseSerializer,
    AdminOrderDetailsResponseSerializer,
    AdminOrderNotesResponseSerializer,
    AdminOrderStatusUpdateRequestSerializer,
    AdminOrderActionResponseSerializer,
    AdminOrderSyncExternalResponseSerializer,
)
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from django.conf import settings
from apps.users.models import User as DjangoUser
from apps.users.legacy_models import LegacyUser
from apps.products.models import (
    Product as TenantProduct,
    ProductPackage as TenantProductPackage,
    PackagePrice,
)
from apps.currencies.models import Currency
from .services import (
    apply_order_status_change,
    OrderStatusError,
    OrderNotFoundError,
    TenantMismatchError,
    LegacyUserMissingError,
    OverdraftExceededError,
    _append_system_note,
)

logger = logging.getLogger(__name__)
try:
    from apps.tenants.models import TenantDomain  # type: ignore
except Exception:
    TenantDomain = None

CODES_PROVIDER_ID = '__CODES__'


def _resolve_tenant_id(request) -> str | None:
    # Direct override via X-Tenant-Id when provided
    direct_tid = request.META.get('HTTP_X_TENANT_ID')
    if direct_tid:
        return str(direct_tid)
    host_header = request.META.get(settings.TENANT_HEADER) or request.META.get('HTTP_HOST')
    if host_header and TenantDomain is not None:
        host = host_header.split(':')[0]
        try:
            dom = TenantDomain.objects.filter(domain=host).order_by('-is_primary').first()
            if dom and getattr(dom, 'tenant_id', None):
                return str(dom.tenant_id)
        except Exception:
            pass
    tid = getattr(request, 'tenant', None)
    if tid and getattr(tid, 'id', None):
        return str(tid.id)
    user = getattr(request, 'user', None)
    if user and getattr(user, 'tenant_id', None):
        return str(user.tenant_id)
    return None


def _resolve_legacy_user_for_request(request, user, tenant_id, *, required=True) -> LegacyUser | None:
    logger.info(f"[_resolve_legacy_user] Starting resolution for user: {user}, tenant_id: {tenant_id}")
    logger.info(f"[_resolve_legacy_user] User authenticated: {getattr(user, 'is_authenticated', False)}")
    
    if not getattr(user, 'is_authenticated', False):
        logger.warning("[_resolve_legacy_user] User not authenticated")
        if required:
            raise PermissionDenied('AUTH_REQUIRED')
        return None

    legacy_user: LegacyUser | None = None
    candidate_ids: set[uuid.UUID] = set()

    def _collect_candidate(raw_value) -> None:
        if not raw_value:
            return
        try:
            candidate_ids.add(uuid.UUID(str(raw_value)))
            logger.info(f"[_resolve_legacy_user] Added candidate ID: {raw_value}")
        except (ValueError, TypeError):
            logger.debug('Ignoring non-UUID legacy user candidate', extra={'value': raw_value})

    _collect_candidate(getattr(user, 'id', None))
    header_override = request.META.get('HTTP_X_LEGACY_USER_ID')
    if not header_override:
        try:
            header_override = request.headers.get('X-Legacy-User-Id')  # type: ignore[attr-defined]
        except Exception:
            header_override = None
    _collect_candidate(header_override)
    _collect_candidate(getattr(user, 'legacy_user_id', None))

    logger.info(f"[_resolve_legacy_user] Candidate IDs: {candidate_ids}")

    for candidate_id in candidate_ids:
        try:
            legacy_user = LegacyUser.objects.get(id=candidate_id, tenant_id=tenant_id)
            logger.info(f"[_resolve_legacy_user] Found legacy user by ID {candidate_id}: {legacy_user.username}")
            break
        except LegacyUser.DoesNotExist:
            logger.debug(f"[_resolve_legacy_user] No legacy user found with ID {candidate_id}")
            continue

    if legacy_user is None:
        logger.info("[_resolve_legacy_user] No match by ID, trying fallback by email/username")
        fallback_qs = LegacyUser.objects.filter(tenant_id=tenant_id)
        user_email = getattr(user, 'email', None)
        logger.info(f"[_resolve_legacy_user] User email: {user_email}")
        if user_email:
            legacy_user = fallback_qs.filter(email__iexact=user_email).first()
            if legacy_user:
                logger.info(f"[_resolve_legacy_user] Found legacy user by email: {legacy_user.username}")
        if legacy_user is None:
            username = getattr(user, 'username', None)
            logger.info(f"[_resolve_legacy_user] User username: {username}")
            if username:
                legacy_user = fallback_qs.filter(username__iexact=username).first()
                if legacy_user:
                    logger.info(f"[_resolve_legacy_user] Found legacy user by username: {legacy_user.username}")

    if legacy_user is None and required:
        logger.error(f"[_resolve_legacy_user] No legacy user found for Django user {user.username} in tenant {tenant_id}")
        raise NotFound('المستخدم غير موجود ضمن هذا المستأجر')

    return legacy_user


def _resolve_price_group_id(*, django_user, legacy_user) -> uuid.UUID | None:
    for source in (getattr(django_user, 'price_group_id', None), getattr(legacy_user, 'price_group_id', None)):
        if not source:
            continue
        try:
            return uuid.UUID(str(source))
        except (ValueError, TypeError):
            continue
    return None


def _get_effective_package_price_usd(pkg, tenant_id, price_group_id: uuid.UUID | None) -> Decimal:
    qs = PackagePrice.objects.filter(tenant_id=tenant_id, package_id=pkg.id)
    row = None
    if price_group_id:
        row = qs.filter(price_group_id=price_group_id).first()
    if row is None:
        row = qs.first()

    candidate = None
    if row is not None:
        unit_val = getattr(row, 'unit_price', None)
        if unit_val not in (None, ''):
            candidate = unit_val
        elif getattr(row, 'price', None) not in (None, ''):
            candidate = row.price

    if candidate is None:
        candidate = pkg.base_price or pkg.capital or 0

    try:
        value = Decimal(candidate)
    except (InvalidOperation, TypeError, ValueError):
        value = Decimal('0')

    return value


def _resolve_currency_for_user(tenant_id, legacy_user: LegacyUser) -> tuple[str, Decimal]:
    code = (getattr(legacy_user, 'preferred_currency_code', '') or '').strip().upper()
    currency_row: Currency | None = None
    if getattr(legacy_user, 'currency_id', None):
        currency_row = Currency.objects.filter(tenant_id=tenant_id, id=legacy_user.currency_id).first()
    if currency_row is None and code:
        currency_row = Currency.objects.filter(tenant_id=tenant_id, code__iexact=code).first()
    if currency_row:
        code = (currency_row.code or code or 'USD').upper()
        rate_raw = currency_row.rate or 1
    else:
        rate_raw = 1
    try:
        rate = Decimal(rate_raw)
    except (InvalidOperation, TypeError, ValueError):
        rate = Decimal('1')
    if rate <= 0:
        rate = Decimal('1')
    return (code or 'USD', rate)


class MyOrdersListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Orders"],
        parameters=[
            OpenApiParameter(name='limit', required=False, type=int, description='Page size (1..100)'),
            OpenApiParameter(name='cursor', required=False, type=str, description='Cursor from previous page (ISO datetime)'),
        ],
        responses={200: OrdersListResponseSerializer},
        examples=[OpenApiExample('Orders page', value={'items':[{'id':'9d3e...','status':'pending','createdAt':'2025-09-20T12:00:00Z','product':{'id':'a1','name':'Game X'},'package':{'id':'b1','name':'100 Gems','productId':'a1'},'quantity':1,'userIdentifier':'user#123','extraField':None,'orderNo':1001,'priceUSD':10.0,'unitPriceUSD':10.0,'display':{'currencyCode':'USD','totalPrice':10.0,'unitPrice':10.0}}],'pageInfo':{'nextCursor':None,'hasMore':False}})]
    )
    def get(self, request):
        print(f"\n{'='*80}")
        print(f"[MyOrdersListView] NEW REQUEST")
        print(f"{'='*80}")
        print(f"User: {request.user}")
        print(f"Authenticated: {request.user.is_authenticated}")
        print(f"X-Tenant-Host: {request.META.get('HTTP_X_TENANT_HOST')}")
        print(f"X-Tenant-Id: {request.META.get('HTTP_X_TENANT_ID')}")
        
        logger.info(f"[MyOrdersListView] Request from user: {request.user}, authenticated: {request.user.is_authenticated}")
        logger.info(f"[MyOrdersListView] Headers: X-Tenant-Host={request.META.get('HTTP_X_TENANT_HOST')}, X-Tenant-Id={request.META.get('HTTP_X_TENANT_ID')}")
        
        tenant_id_raw = _resolve_tenant_id(request)
        print(f"Resolved tenant_id: {tenant_id_raw}")
        logger.info(f"[MyOrdersListView] Resolved tenant_id: {tenant_id_raw}")
        
        if not tenant_id_raw:
            logger.warning("[MyOrdersListView] TENANT_ID_REQUIRED - no tenant resolved")
            raise ValidationError('TENANT_ID_REQUIRED')

        try:
            tenant_uuid = uuid.UUID(str(tenant_id_raw))
        except (ValueError, TypeError):
            logger.error(f"[MyOrdersListView] TENANT_ID_INVALID: {tenant_id_raw}")
            raise ValidationError('TENANT_ID_INVALID')

        limit = int(request.query_params.get('limit') or 20)
        limit = max(1, min(limit, 100))
        cursor_raw = request.query_params.get('cursor') or None

        legacy_user = _resolve_legacy_user_for_request(request, request.user, tenant_uuid, required=False)
        logger.info(f"[MyOrdersListView] Resolved legacy_user: {legacy_user}")
        
        # TEMPORARY FIX: Show ALL orders in tenant for testing (ignore user filter)
        # if legacy_user is None:
        #     logger.warning(f"[MyOrdersListView] No legacy user found for user {request.user.username}, returning empty list")
        #     return Response({ 'items': [], 'pageInfo': { 'nextCursor': None, 'hasMore': False } })

        # Show ALL orders in this tenant (for testing infinite loop scenario)
        qs = ProductOrder.objects.filter(
            tenant_id=tenant_uuid,
            # user_id=legacy_user.id,  # COMMENTED OUT FOR TESTING
        ).order_by('-created_at')
        
        print(f"Query filter: tenant_id={tenant_uuid}")
        print(f"Total orders in DB: {qs.count()}")

        if cursor_raw:
            try:
                cursor_dt = datetime.fromisoformat(cursor_raw)
                qs = qs.filter(created_at__lt=cursor_dt)
            except Exception:
                pass

        items = list(qs.select_related('product', 'package')[: limit + 1])
        print(f"Items fetched: {len(items)}")
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None

        data = OrderListItemSerializer(items, many=True).data
        return Response({ 'items': data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more } })


class OrdersCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Orders"],
        request=OrderCreateRequestSerializer,
        responses={201: OrderListItemSerializer}
    )
    def post(self, request):
        # Add detailed logging for debugging
        print(f"Order creation request: {request.data}")
        print(f"Headers: {dict(request.headers)}")
        
        tenant_id = _resolve_tenant_id(request)
        print(f"Resolved tenant_id: {tenant_id}")
        
        if not tenant_id:
            print("TENANT_ID_REQUIRED - tenant resolution failed")
            raise ValidationError('TENANT_ID_REQUIRED')

        serializer = OrderCreateRequestSerializer(data=request.data)
        if not serializer.is_valid():
            print(f"Serializer validation failed: {serializer.errors}")
            raise ValidationError(serializer.errors)
        payload = serializer.validated_data
        print(f"Serializer validation passed: {payload}")

        quantity_raw = payload.get('quantity') or 1
        try:
            quantity = int(quantity_raw)
        except (TypeError, ValueError):
            raise ValidationError('الكمية غير صالحة')
        if quantity <= 0:
            raise ValidationError('الكمية يجب أن تكون أكبر من صفر')

        try:
            tenant_uuid = uuid.UUID(str(tenant_id))
        except (ValueError, TypeError):
            raise ValidationError('TENANT_ID_INVALID')

        product_id = payload['productId']
        package_id = payload['packageId']
        user_identifier = (payload.get('userIdentifier') or '').strip() or None
        extra_field = (payload.get('extraField') or '').strip() or None

        request_user = request.user
        print(f"Request user: {request_user}")
        print(f"User authenticated: {request_user.is_authenticated}")

        with transaction.atomic():
            print(f"Looking for legacy user for tenant: {tenant_uuid}")
            legacy_user = _resolve_legacy_user_for_request(request, request_user, tenant_uuid, required=True)
            print(f"Legacy user found: {legacy_user}")
            if legacy_user is None:
                print("ERROR: Legacy user not found")
                raise NotFound('المستخدم غير موجود ضمن هذا المستأجر')

            print(f"Looking for product: {product_id} in tenant: {tenant_uuid}")
            product = TenantProduct.objects.filter(id=product_id, tenant_id=tenant_uuid).first()
            print(f"Product found: {product}")
            if not product:
                print("ERROR: Product not found")
                raise NotFound('المنتج غير موجود')

            print(f"Looking for package: {package_id} in tenant: {tenant_uuid}")
            package = TenantProductPackage.objects.filter(id=package_id, tenant_id=tenant_uuid).first()
            print(f"Package found: {package}")
            if not package:
                print("ERROR: Package not found")
                raise NotFound('الباقة غير موجودة')

            print(f"Checking package belongs to product: {package.product_id} == {product.id}")
            if str(package.product_id) != str(product.id):
                print("ERROR: Package does not belong to product")
                raise ValidationError('الباقة لا تنتمي إلى هذا المنتج')

            print(f"Resolving price group for user: {request_user}")
            price_group_id = _resolve_price_group_id(django_user=request_user, legacy_user=legacy_user)
            print(f"Price group ID: {price_group_id}")
            
            print(f"Getting effective package price for package: {package.id}")
            unit_price_usd = _get_effective_package_price_usd(package, tenant_uuid, price_group_id)
            print(f"Unit price USD: {unit_price_usd}")
            if unit_price_usd <= 0:
                print("ERROR: Price not available for this package")
                raise ValidationError('السعر غير متاح لهذه الباقة')

            print(f"Quantizing unit price: {unit_price_usd}")
            price_quant = Decimal('0.0001')
            try:
                unit_price_usd = unit_price_usd.quantize(price_quant, ROUND_HALF_UP)
                print(f"Quantized unit price: {unit_price_usd}")
            except (InvalidOperation, AttributeError):
                unit_price_usd = Decimal('0')
                print(f"Error quantizing price, set to 0: {unit_price_usd}")
            if unit_price_usd <= 0:
                print("ERROR: Unit price is 0 or negative")
                raise ValidationError('السعر غير متاح لهذه الباقة')

            print(f"Calculating total for quantity: {quantity}")
            quantity_dec = Decimal(quantity)
            total_usd = (unit_price_usd * quantity_dec).quantize(price_quant, ROUND_HALF_UP)
            print(f"Total USD: {total_usd}")

            print(f"Resolving currency for user: {legacy_user}")
            currency_code, currency_rate = _resolve_currency_for_user(tenant_uuid, legacy_user)
            print(f"Currency: {currency_code}, Rate: {currency_rate}")
            total_user = (total_usd * currency_rate).quantize(Decimal('0.01'), ROUND_HALF_UP)
            print(f"Total user currency: {total_user}")

            print(f"Locking legacy user for balance check: {legacy_user.id}")
            legacy_user_locked = LegacyUser.objects.select_for_update().get(id=legacy_user.id, tenant_id=tenant_uuid)
            available_user_balance = Decimal(legacy_user_locked.balance or 0) + Decimal(legacy_user_locked.overdraft_limit or 0)
            print(f"Available user balance: {available_user_balance}")
            print(f"Required amount: {total_user}")
            if total_user > available_user_balance:
                print("ERROR: Insufficient balance")
                raise ValidationError('الرصيد غير كافٍ لتنفيذ الطلب')

            print(f"Updating legacy user balance")
            new_legacy_balance = (Decimal(legacy_user_locked.balance or 0) - total_user).quantize(Decimal('0.01'), ROUND_HALF_UP)
            print(f"New legacy balance: {new_legacy_balance}")
            legacy_user_locked.balance = new_legacy_balance
            legacy_user_locked.save(update_fields=['balance'])

            print(f"Locking Django user for balance update: {request_user.id}")
            django_user_locked = DjangoUser.objects.select_for_update().get(id=request_user.id)
            django_balance = Decimal(django_user_locked.balance or 0)
            print(f"Current Django balance: {django_balance}")
            new_django_balance = (django_balance - total_user).quantize(Decimal('0.000001'), ROUND_HALF_UP)
            print(f"New Django balance: {new_django_balance}")
            django_user_locked.balance = new_django_balance
            django_user_locked.save(update_fields=['balance'])
            try:
                request_user.balance = new_django_balance
            except Exception:
                pass

            order = ProductOrder.objects.create(
                id=uuid.uuid4(),
                tenant_id=tenant_uuid,
                user_id=legacy_user_locked.id,
                product_id=product.id,
                package_id=package.id,
                quantity=quantity,
                status='pending',
                price=total_usd,
                sell_price_currency=currency_code or 'USD',
                sell_price_amount=total_user,
                created_at=timezone.now(),
                user_identifier=user_identifier,
                extra_field=extra_field,
                notes=[],
                notes_count=0,
            )

            if settings.FF_USD_COST_ENFORCEMENT:
                try:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            """
                            UPDATE product_orders
                            SET sell_usd_at_order = %s,
                                fx_usd_try_at_order = %s
                            WHERE id = %s
                            """,
                            [float(total_usd), float(currency_rate or 1), str(order.id)],
                        )
                except Exception as exc:
                    logger.warning(
                        "Failed to persist initial sell snapshot",
                        extra={"order_id": str(order.id), "error": str(exc)},
                    )
                else:
                    try:
                        order.sell_usd_at_order = total_usd
                        order.fx_usd_try_at_order = currency_rate
                    except Exception:
                        pass
            
            # ✅ تسجيل المعاملة في المحفظة عند إنشاء الطلب (خصم فوري)
            from apps.users.wallet_helpers import record_wallet_transaction
            try:
                order_short_id = str(order.id)[:8]
                package_name = getattr(package, 'name', 'باقة غير معروفة') if package else 'باقة غير معروفة'
                
                description = f"إنشاء طلب ({order_short_id})\n{package_name}"
                if user_identifier:
                    description += f" - ID: {user_identifier}"
                
                # الرصيد قبل الخصم، بعد الخصم
                record_wallet_transaction(
                    user=django_user_locked,
                    transaction_type='approved',
                    amount=total_user,
                    description=description,
                    order_id=str(order.id),
                    balance_before=django_balance,  # الرصيد قبل الخصم
                    metadata={
                        'order_status': 'pending',
                        'package_name': package_name,
                        'user_identifier': user_identifier or '',
                        'created_at_order': True,  # علامة أن المعاملة أُنشئت مع الطلب
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to record wallet transaction on order creation: {e}")

        # محاولة التوجيه التلقائي للمزود الخارجي (الآن بشكل غير متزامن - سريع!)
        from apps.orders.services import try_auto_dispatch_async
        print(f"\n[DEBUG] Order BEFORE auto-dispatch:")
        print(f"  - Order ID: {order.id}")
        print(f"  - Provider ID: {order.provider_id}")
        print(f"  - External Order ID: {order.external_order_id}")
        print(f"  - External Status: {order.external_status}")
        print(f"\nAttempting ASYNC auto-dispatch for order: {order.id}")
        try:
            dispatch_result = try_auto_dispatch_async(str(order.id), str(tenant_uuid))
            if dispatch_result.get('dispatched'):
                print(f"Order dispatched in background - Task ID: {dispatch_result.get('task_id')}")
            else:
                print(f"Order not dispatched: {dispatch_result.get('reason')}")
        except Exception as e:
            # لا نفشل الطلب إذا فشل التوجيه التلقائي
            import logging
            logger = logging.getLogger(__name__)
            print(f"Auto-dispatch exception caught in view: {type(e).__name__}: {str(e)}")
            logger.warning("Auto-dispatch failed for order", extra={
                "order_id": str(order.id),
                "error": str(e)
            })

        created = ProductOrder.objects.select_related('product', 'package').get(id=order.id)
        return Response(OrderListItemSerializer(created).data, status=201)


class AdminPendingOrdersCountView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Orders"], responses={200: None})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        count = ProductOrder.objects.filter(tenant_id=tenant_id, status='pending').count()
        return Response({ 'count': int(count) })


class AdminOrdersListView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Orders"],
        parameters=[
            OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER, description='Tenant host header'),
            OpenApiParameter(name='limit', required=False, type=int),
            OpenApiParameter(name='cursor', required=False, type=str),
            OpenApiParameter(name='status', required=False, type=str, description='pending|approved|rejected'),
            OpenApiParameter(name='method', required=False, type=str, description='manual|internal_codes|<providerId>'),
            OpenApiParameter(name='from', required=False, type=str, description='ISO date (YYYY-MM-DD) inclusive'),
            OpenApiParameter(name='to', required=False, type=str, description='ISO date (YYYY-MM-DD) inclusive'),
            OpenApiParameter(name='q', required=False, type=str, description='Search userIdentifier/extraField'),
        ],
        responses={200: AdminOrdersListResponseSerializer},
    )
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')

        limit = int(request.query_params.get('limit') or 20)
        limit = max(1, min(limit, 100))
        cursor = request.query_params.get('cursor') or None
        status_filter = (request.query_params.get('status') or '').strip()
        method_filter = (request.query_params.get('method') or '').strip()
        from_date = (request.query_params.get('from') or '').strip()
        to_date = (request.query_params.get('to') or '').strip()
        q = (request.query_params.get('q') or '').strip()

        qs = ProductOrder.objects.filter(tenant_id=tenant_id).order_by('-created_at')
        if status_filter in ('pending','approved','rejected'):
            qs = qs.filter(status=status_filter)
        # method filter: 'manual' => provider_id is null and external_status not sent; 'internal_codes' => provider_message like code; else provider_id equals filter
        if method_filter:
            if method_filter == 'manual':
                qs = qs.filter(provider_id__isnull=True)
            elif method_filter == 'internal_codes':
                qs = qs.filter(external_status='completed', pin_code__isnull=False)
            else:
                qs = qs.filter(provider_id=method_filter)
        # date range by approvedLocalDate when present else created_at
        try:
            if from_date:
                # include whole day: compare on created_at >= from_date 00:00
                dt = datetime.fromisoformat(from_date)
                qs = qs.filter(created_at__date__gte=dt.date())
            if to_date:
                dt = datetime.fromisoformat(to_date)
                qs = qs.filter(created_at__date__lte=dt.date())
        except Exception:
            pass
        if q:
            qs = qs.annotate(id_text=Cast('id', CharField()))
            search_filters = (
                Q(user_identifier__icontains=q) |
                Q(extra_field__icontains=q) |
                Q(user__username__icontains=q) |
                Q(user__email__icontains=q) |
                Q(product__name__icontains=q) |
                Q(package__name__icontains=q) |
                Q(id_text__icontains=q)
            )

            if q.isdigit():
                try:
                    search_filters |= Q(order_no=int(q))
                except (TypeError, ValueError):
                    pass

            try:
                query_uuid = uuid.UUID(q)
            except (ValueError, TypeError, AttributeError):
                query_uuid = None
            if query_uuid:
                search_filters |= Q(id=query_uuid)

            qs = qs.filter(search_filters)
        if cursor:
            try:
                qs = qs.filter(created_at__lt=cursor)
            except Exception:
                pass

        items = list(qs.select_related('product', 'package', 'user')[: limit + 1])
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None

        data = AdminOrderListItemSerializer(items, many=True).data
        meta = {
            'features': {
                'adminReroute': bool(getattr(settings, 'FF_ADMIN_REROUTE_UI', False)),
                'chainStatusPropagation': bool(getattr(settings, 'FF_CHAIN_STATUS_PROPAGATION', False)),
                'usdCostEnforcement': bool(getattr(settings, 'FF_USD_COST_ENFORCEMENT', False)),
                'autoFallbackRouting': bool(getattr(settings, 'FF_AUTO_FALLBACK_ROUTING', False)),
            }
        }
        return Response({ 'items': data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more }, 'meta': meta })


class MyOrderDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Orders"], responses={200: MyOrderDetailsResponseSerializer})
    def get(self, request, id: str):
        user = request.user
        
        # Resolve tenant
        tenant_id_raw = _resolve_tenant_id(request)
        if not tenant_id_raw:
            raise ValidationError('TENANT_ID_REQUIRED')
        
        try:
            tenant_uuid = uuid.UUID(str(tenant_id_raw))
        except (ValueError, TypeError):
            raise ValidationError('TENANT_ID_INVALID')
        
        # Get order
        try:
            o = ProductOrder.objects.select_related('product', 'package', 'user').get(id=id)
        except ProductOrder.DoesNotExist:
            raise NotFound('الطلب غير موجود')
        
        # Resolve legacy user for current request
        legacy_user = _resolve_legacy_user_for_request(request, user, tenant_uuid, required=True)
        
        # Check if order belongs to this user
        if str(o.user_id or '') != str(legacy_user.id):
            raise PermissionDenied('لا تملك صلاحية على هذا الطلب')

        # details payload: merge list item fields + details
        base = OrderListItemSerializer(o).data
        details = {
            'manualNote': o.manual_note,
            'notes': o.notes or [],
            'externalStatus': o.external_status,
            'lastMessage': o.last_message,
            'providerMessage': o.provider_message,
            'pinCode': o.pin_code,
        }
        return Response({ **base, **details })


class AdminOrderNotesView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def _assert_tenant(self, request, order: ProductOrder):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        if str(order.tenant_id or '') != str(tenant_id):
            raise PermissionDenied(f'لا تملك صلاحية على هذا الطلب (orderTid={order.tenant_id}, reqTid={tenant_id})')

    @extend_schema(tags=["Admin Orders"], responses={200: AdminOrderNotesResponseSerializer})
    def get(self, request, id: str):
        try:
            o = ProductOrder.objects.get(id=id)
        except ProductOrder.DoesNotExist:
            raise NotFound('الطلب غير موجود')
        self._assert_tenant(request, o)
        return Response({ 'orderId': str(o.id), 'notes': o.notes or [] })

    @extend_schema(tags=["Admin Orders"], responses={200: AdminOrderNotesResponseSerializer})
    def post(self, request, id: str):
        text = str(request.data.get('text') or '').strip()
        by = (request.data.get('by') or 'admin').strip()
        if not text:
            raise ValidationError('النص مطلوب')
        try:
            o = ProductOrder.objects.get(id=id)
        except ProductOrder.DoesNotExist:
            raise NotFound('الطلب غير موجود')
        self._assert_tenant(request, o)

        import datetime
        note = { 'by': by if by in ('admin','system','user') else 'admin', 'text': text, 'at': datetime.datetime.utcnow().isoformat() }
        notes = list(o.notes or [])
        notes.append(note)
        o.notes = notes
        try:
            # increment notesCount if present
            if o.notes_count is not None:
                o.notes_count = int(o.notes_count) + 1
            o.save(update_fields=['notes', 'notes_count'])
        except Exception:
            o.save()
        return Response({ 'orderId': str(o.id), 'notes': o.notes or [] })


class AdminOrderDetailsView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def _assert_tenant(self, request, order: ProductOrder):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        if str(order.tenant_id or '') != str(tenant_id):
            raise PermissionDenied(f'لا تملك صلاحية على هذا الطلب (orderTid={order.tenant_id}, reqTid={tenant_id})')

    @extend_schema(tags=["Admin Orders"], responses={200: AdminOrderDetailsResponseSerializer})
    def get(self, request, id: str):
        try:
            o = ProductOrder.objects.select_related('product', 'package', 'user').get(id=id)
        except ProductOrder.DoesNotExist:
            raise NotFound('الطلب غير موجود')
        self._assert_tenant(request, o)
        # Use admin list shape as base and enrich with details fields as admin expects
        base = AdminOrderListItemSerializer(o).data
        details = {
            'providerId': o.provider_id,
            'externalOrderId': o.external_order_id,
            'externalStatus': o.external_status,
            'lastMessage': o.last_message,
            'pinCode': o.pin_code,
            'notes': o.notes or [],
        }
        meta = {
            'features': {
                'adminReroute': bool(getattr(settings, 'FF_ADMIN_REROUTE_UI', False)),
                'chainStatusPropagation': bool(getattr(settings, 'FF_CHAIN_STATUS_PROPAGATION', False)),
                'usdCostEnforcement': bool(getattr(settings, 'FF_USD_COST_ENFORCEMENT', False)),
                'autoFallbackRouting': bool(getattr(settings, 'FF_AUTO_FALLBACK_ROUTING', False)),
            }
        }
        return Response({ 'order': { **base, **details }, 'meta': meta })

    @extend_schema(
        tags=["Admin Orders"],
        request=AdminOrderStatusUpdateRequestSerializer,
        responses={200: AdminOrderActionResponseSerializer}
    )
    def patch(self, request, id: str):
        # Minimal approve/reject update (write to status + optional manualNote)
        action = str(request.data.get('status') or '').strip()
        note = str(request.data.get('note') or '').strip()
        if action not in ('approved', 'rejected'):
            raise ValidationError('الحالة غير صحيحة')

        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')

        try:
            result = apply_order_status_change(
                order_id=id,
                next_status=action,
                expected_tenant_id=tenant_id,
                note=note or None,
            )
        except OrderNotFoundError:
            raise NotFound('الطلب غير موجود')
        except TenantMismatchError as exc:
            raise PermissionDenied(str(exc) or 'لا تملك صلاحية على هذا الطلب')
        except LegacyUserMissingError:
            raise ValidationError('المستخدم المرتبط بالطلب غير موجود')
        except OverdraftExceededError:
            raise ValidationError('الرصيد غير كافٍ لإعادة خصم الطلب (تجاوز حد السالب المسموح)')
        except OrderStatusError as exc:
            raise ValidationError(str(exc) or 'تعذر تحديث حالة الطلب')
        except Exception as exc:  # noqa: BLE001 - surface unexpected issues gracefully
            logger.exception('Unexpected error while changing order status', extra={'order_id': id})
            raise ValidationError('تعذر تحديث حالة الطلب') from exc

        return Response({ 'ok': True, 'id': str(result.order.id), 'status': result.order.status })


class AdminOrderSyncExternalView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def _assert_tenant(self, request, order: ProductOrder):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        if str(order.tenant_id or '') != str(tenant_id):
            raise PermissionDenied(f'لا تملك صلاحية على هذا الطلب (orderTid={order.tenant_id}, reqTid={tenant_id})')

    @extend_schema(tags=["Admin Orders"], responses={200: AdminOrderSyncExternalResponseSerializer})
    def patch(self, request, id: str):
        # Implement routing-based dispatch simulation: choose provider via routing and use package mapping, then mark as sent
        try:
            o = ProductOrder.objects.select_related('package').get(id=id)
        except ProductOrder.DoesNotExist:
            raise NotFound('الطلب غير موجود')
        self._assert_tenant(request, o)

        # Preconditions: only pending orders without external dispatch
        if o.status != 'pending':
            return Response({ 'message': 'لا يمكن الإرسال — حالة الطلب ليست pending', 'order': { 'id': str(o.id), 'externalStatus': o.external_status, 'providerMessage': o.provider_message, 'lastMessage': o.last_message } })
        if o.provider_id or o.external_order_id:
            return Response({ 'message': 'تم الإرسال سابقًا لهذا الطلب', 'order': { 'id': str(o.id), 'externalStatus': o.external_status, 'providerMessage': o.provider_message, 'lastMessage': o.last_message } })

        tenant_id = _resolve_tenant_id(request) or ''
        package_id = getattr(o, 'package_id', None) or (getattr(o, 'package', None) and getattr(o.package, 'id', None))
        if not package_id:
            return Response({ 'message': 'لا توجد باقة مرتبطة بالطلب', 'order': { 'id': str(o.id) } })

        # Load routing
        try:
            routing = PackageRouting.objects.get(tenant_id=tenant_id, package_id=package_id)
        except PackageRouting.DoesNotExist:
            return Response({ 'message': 'لا يوجد توجيه مكوَّن لهذه الباقة', 'order': { 'id': str(o.id) } })
        if routing.mode != 'auto' or routing.provider_type != 'external' or not routing.primary_provider_id:
            return Response({ 'message': 'التوجيه ليس Auto/External أو لا يوجد primaryProviderId', 'order': { 'id': str(o.id) } })

        chosen_provider_id = routing.primary_provider_id

        # Find mapping for provider + package (handle potential type cast differences)
        provider_package_id = None
        with connection.cursor() as c:
            c.execute('SELECT provider_package_id FROM package_mappings WHERE "tenantId"=%s AND our_package_id=%s AND provider_api_id::text=%s LIMIT 1',
                      [tenant_id, str(package_id), str(chosen_provider_id)])
            row = c.fetchone()
            if row:
                provider_package_id = row[0]
        if not provider_package_id:
            return Response({ 'message': 'لا يوجد Mapping لهذه الباقة مع المزوّد المحدد', 'order': { 'id': str(o.id) } })

        # Try real provider adapter first
        external_id = None
        status = 'sent'
        note = None
        try:
            integ = Integration.objects.get(id=chosen_provider_id, tenant_id=tenant_id)
            binding, creds = resolve_adapter_credentials(
                integ.provider,
                base_url=integ.base_url,
                api_token=getattr(integ, 'api_token', None),
                kod=getattr(integ, 'kod', None),
                sifre=getattr(integ, 'sifre', None),
            )
            if binding:
                adapter = binding.adapter
                # prefer order_no as provider referans when available
                referans = str(o.order_no) if getattr(o, 'order_no', None) else str(o.id)
                payload = {
                    'orderId': str(o.id),
                    'referans': referans,
                    'userIdentifier': o.user_identifier,
                    'extraField': o.extra_field,
                    # 'kupur': <optional>, if needed by mapping/config in future
                }
                res = adapter.place_order(creds, str(provider_package_id), payload)
                external_id = res.get('externalOrderId') or external_id
                status = res.get('status') or status
                note = res.get('note') or None
                # If provider returns balance, persist on integration
                try:
                    if res.get('balance') is not None:
                        with connection.cursor() as c:
                            c.execute('UPDATE integrations SET balance=%s, "balanceUpdatedAt"=NOW() WHERE id=%s', [res.get('balance'), str(integ.id)])
                except Exception:
                    pass
        except Exception as e:
            note = f"Adapter error: {getattr(e, 'message', str(e))[:200]}"

        # Persist as sent (real or simulated)
        now = timezone.now()
        o.provider_id = str(chosen_provider_id)
        o.external_order_id = external_id or f"stub-{o.id}"
        o.external_status = status or 'sent'
        o.sent_at = now
        o.provider_message = note or f"Dispatched to provider {chosen_provider_id} product={provider_package_id}"
        o.last_message = 'Order sent to provider'
        try:
            o.save(update_fields=['provider_id','external_order_id','external_status','sent_at','provider_message','last_message'])
        except Exception:
            o.save()

        return Response({ 'message': 'تم إرسال الطلب إلى المزوّد', 'order': { 'id': str(o.id), 'externalStatus': o.external_status, 'providerMessage': o.provider_message, 'lastMessage': o.last_message } })

class AdminOrderRefreshStatusView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def _assert_tenant(self, request, order: ProductOrder):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        if str(order.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذا الطلب')

    @extend_schema(tags=["Admin Orders"], responses={200: AdminOrderActionResponseSerializer})
    def post(self, request, id: str):
        try:
            o = ProductOrder.objects.get(id=id)
        except ProductOrder.DoesNotExist:
            raise NotFound('الطلب غير موجود')
        self._assert_tenant(request, o)
        if not o.provider_id or not o.external_order_id:
            return Response({ 'message': 'الطلب غير مُرسل إلى مزوّد بعد', 'order': { 'id': str(o.id) } })
        tenant_id = _resolve_tenant_id(request) or ''
        try:
            integ = Integration.objects.get(id=o.provider_id, tenant_id=tenant_id)
        except Integration.DoesNotExist:
            raise NotFound('تكامل المزوّد غير موجود')
        binding, creds = resolve_adapter_credentials(
            integ.provider,
            base_url=integ.base_url,
            api_token=getattr(integ, 'api_token', None),
            kod=getattr(integ, 'kod', None),
            sifre=getattr(integ, 'sifre', None),
        )
        if not binding:
            raise ValidationError('لا يوجد Adapter لهذا المزوّد')
        try:
            res = binding.adapter.fetch_status(creds, str(o.external_order_id))
        except Exception as e:
            return Response({ 'message': f'فشل الاستعلام عن الحالة: {str(e)[:200]}', 'order': { 'id': str(o.id), 'externalStatus': o.external_status } }, status=502)
        # Map and persist
        o.external_status = res.get('status') or o.external_status
        if res.get('pinCode'):
            o.pin_code = res.get('pinCode')
        msg = res.get('message') or ''
        o.provider_message = (msg or '')[:1000]
        o.last_message = (res.get('raw') or msg or '')[:250]
        if o.external_status == 'completed' and o.completed_at is None:
            o.completed_at = timezone.now()
        try:
            o.save(update_fields=['external_status','pin_code','provider_message','last_message','completed_at'])
        except Exception:
            o.save()
        return Response({ 'ok': True, 'order': { 'id': str(o.id), 'externalStatus': o.external_status, 'pinCode': o.pin_code, 'providerMessage': o.provider_message, 'lastMessage': o.last_message } })


class AdminOrderAuditLogView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]
    _ALLOWED_ACTIONS = {'DISPATCH', 'FALLBACK', 'FALLBACK_START', 'FALLBACK_SUCCESS', 'CHAIN_STATUS'}

    def _assert_tenant(self, request, order: ProductOrder) -> None:
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        if str(order.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذا الطلب')

    @extend_schema(tags=["Admin Orders"])
    def get(self, request, id: str):
        if not getattr(settings, 'FF_ADMIN_REROUTE_UI', False):
            raise NotFound('FEATURE_DISABLED')

        try:
            order = ProductOrder.objects.get(id=id)
        except ProductOrder.DoesNotExist:
            raise NotFound('الطلب غير موجود')

        self._assert_tenant(request, order)

        actions_param = (request.query_params.get('actions') or '').strip()
        if actions_param:
            requested = {part.strip().upper() for part in actions_param.split(',') if part.strip()}
            actions = requested & self._ALLOWED_ACTIONS
            if not actions:
                actions = self._ALLOWED_ACTIONS
        else:
            actions = self._ALLOWED_ACTIONS

        try:
            limit = int(request.query_params.get('limit') or 100)
        except (TypeError, ValueError):
            limit = 100
        limit = max(1, min(limit, 500))

        logs = (
            OrderDispatchLog.objects
            .filter(order_id=order.id, action__in=actions)
            .order_by('-created_at')[:limit]
        )

        items: list[dict[str, object]] = []
        for entry in logs:
            created_at = getattr(entry, 'created_at', None)
            items.append({
                'id': entry.id,
                'orderId': str(order.id),
                'action': entry.action,
                'result': entry.result,
                'message': entry.message,
                'createdAt': created_at.isoformat() if created_at else None,
                'payload': entry.payload_snapshot,
            })

        return Response({
            'orderId': str(order.id),
            'items': items,
            'filters': {
                'actions': sorted(actions),
                'limit': limit,
            },
        })


class _AdminOrdersBulkBaseView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def _get_ids(self, request):
        ids = request.data.get('ids') or []
        if not isinstance(ids, list) or not ids:
            raise ValidationError('ids required')
        # normalize to strings
        return [str(x) for x in ids if x]

    def _tenant(self, request) -> str:
        tid = _resolve_tenant_id(request)
        if not tid:
            raise ValidationError('TENANT_ID_REQUIRED')
        return tid


class AdminOrdersBulkApproveView(_AdminOrdersBulkBaseView):
    @extend_schema(tags=["Admin Orders"])
    def post(self, request):
        ids = self._get_ids(request)
        note = str(request.data.get('note') or '').strip()
        tid = self._tenant(request)
        updated = 0
        errors: list[dict[str, str]] = []
        for oid in ids:
            try:
                apply_order_status_change(
                    order_id=oid,
                    next_status='approved',
                    expected_tenant_id=tid,
                    note=note or None,
                )
                updated += 1
            except OrderNotFoundError:
                continue
            except TenantMismatchError as exc:
                errors.append({'id': oid, 'error': str(exc) or 'TENANT_MISMATCH'})
            except LegacyUserMissingError:
                errors.append({'id': oid, 'error': 'LEGACY_USER_MISSING'})
            except OverdraftExceededError:
                errors.append({'id': oid, 'error': 'OVERDRAFT_EXCEEDED'})
            except OrderStatusError as exc:
                errors.append({'id': oid, 'error': str(exc) or 'STATUS_ERROR'})
            except Exception as exc:  # noqa: BLE001
                logger.exception('Unexpected error during bulk approve', extra={'order_id': oid})
                errors.append({'id': oid, 'error': 'UNEXPECTED_ERROR'})

        payload = { 'ok': True, 'count': updated }
        if errors:
            payload['errors'] = errors
        return Response(payload)


class AdminOrdersBulkRejectView(_AdminOrdersBulkBaseView):
    @extend_schema(tags=["Admin Orders"])
    def post(self, request):
        ids = self._get_ids(request)
        note = str(request.data.get('note') or '').strip()
        tid = self._tenant(request)
        updated = 0
        errors: list[dict[str, str]] = []
        for oid in ids:
            try:
                apply_order_status_change(
                    order_id=oid,
                    next_status='rejected',
                    expected_tenant_id=tid,
                    note=note or None,
                )
                updated += 1
            except OrderNotFoundError:
                continue
            except TenantMismatchError as exc:
                errors.append({'id': oid, 'error': str(exc) or 'TENANT_MISMATCH'})
            except LegacyUserMissingError:
                errors.append({'id': oid, 'error': 'LEGACY_USER_MISSING'})
            except OverdraftExceededError:
                errors.append({'id': oid, 'error': 'OVERDRAFT_EXCEEDED'})
            except OrderStatusError as exc:
                errors.append({'id': oid, 'error': str(exc) or 'STATUS_ERROR'})
            except Exception as exc:  # noqa: BLE001
                logger.exception('Unexpected error during bulk reject', extra={'order_id': oid})
                errors.append({'id': oid, 'error': 'UNEXPECTED_ERROR'})

        payload = { 'ok': True, 'count': updated }
        if errors:
            payload['errors'] = errors
        return Response(payload)


class AdminOrdersBulkManualView(_AdminOrdersBulkBaseView):
    @extend_schema(tags=["Admin Orders"])
    def post(self, request):
        ids = self._get_ids(request)
        note = str(request.data.get('note') or '').strip()
        tid = self._tenant(request)
        updated = 0
        for oid in ids:
            try:
                o = ProductOrder.objects.get(id=oid, tenant_id=tid)
            except ProductOrder.DoesNotExist:
                continue
            # Clear provider/external fields and mark provider_message
            o.provider_id = None
            o.external_order_id = None
            o.external_status = 'not_sent'
            if note:
                o.provider_message = (note or '')[:500]
            try:
                o.save(update_fields=['provider_id','external_order_id','external_status','provider_message'])
            except Exception:
                o.save()
            updated += 1
        return Response({ 'ok': True, 'count': updated })


class AdminOrdersBulkDispatchView(_AdminOrdersBulkBaseView):
    @extend_schema(tags=["Admin Orders"])
    def post(self, request):
        ids = self._get_ids(request)
        tid = self._tenant(request)
        provider_id = str(request.data.get('providerId') or '').strip()
        note = str(request.data.get('note') or '').strip()
        if not provider_id:
            raise ValidationError('providerId required')
        from apps.orders.services import try_auto_dispatch
        manual_placeholders = {'manual', 'manual_provider', 'manual-execution', 'manual_execution', 'manual-order', 'manualorder'}
        manual_external_placeholders = manual_placeholders | {'', 'none', 'null', 'not_sent', 'pending', 'manual_external'}
        provider_is_codes = provider_id == CODES_PROVIDER_ID
        feature_enabled = bool(getattr(settings, 'FF_ADMIN_REROUTE_UI', False))

        def merge_messages(*parts: str | None) -> str | None:
            merged: list[str] = []
            for part in parts:
                if not part:
                    continue
                text = str(part).strip()
                if not text:
                    continue
                if text in merged:
                    continue
                merged.append(text)
            if not merged:
                return None
            return "\n".join(merged)

        results = []
        for oid in ids:
            try:
                o = ProductOrder.objects.get(id=oid, tenant_id=tid)
            except ProductOrder.DoesNotExist:
                results.append({ 'id': oid, 'success': False, 'message': 'not found' })
                continue

            existing_provider = (o.provider_id or '').strip()
            existing_external = (o.external_order_id or '').strip()
            is_manual_placeholder = existing_provider.lower() in manual_placeholders if existing_provider else False
            is_manual_external_placeholder = existing_external.lower() in manual_external_placeholders if existing_external else True
            had_real_provider = bool(existing_provider) and not is_manual_placeholder
            had_real_external = bool(existing_external) and not existing_external.lower().startswith('stub-') and not is_manual_external_placeholder
            
            # Handle chain forwarded orders or orders with existing provider_id
            is_chain_forwarded = existing_provider == 'CHAIN_FORWARD' or existing_external.startswith('stub-')
            has_existing_provider = bool(existing_provider) and existing_provider != provider_id
            
            if is_chain_forwarded or has_existing_provider:
                print(f"   [CLEAR] Order {oid} has existing provider info, clearing for manual dispatch")
                print(f"   - Existing provider: {existing_provider}")
                print(f"   - Target provider: {provider_id}")
                print(f"   - Is chain forwarded: {is_chain_forwarded}")
                print(f"   - Has existing provider: {has_existing_provider}")
                
                # Clear all provider info to allow manual dispatch
                o.provider_id = None
                o.external_order_id = None
                o.provider_message = None
                o.save(update_fields=['provider_id', 'external_order_id', 'provider_message'])
                
                # Reset variables after clearing
                existing_provider = ''
                existing_external = ''
                had_real_provider = False
                had_real_external = False

            # Check status case-insensitive to support both 'pending' and 'PENDING'
            current_status = (o.status or '').strip().lower()
            if current_status not in ('pending', ''):
                results.append({ 'id': oid, 'success': False, 'message': 'already processed' })
                continue

            if feature_enabled and not provider_is_codes and had_real_provider and had_real_external and existing_provider == provider_id:
                results.append({
                    'id': oid,
                    'success': True,
                    'warning': 'already-dispatched',
                    'message': 'Order already dispatched to selected provider',
                })
                continue

            previous_assignment = None
            if had_real_provider or had_real_external:
                previous_assignment = f"redirected from provider {existing_provider or '-'} external {existing_external or '-'}"

            existing_message = (o.provider_message or '').strip()
            combined_admin_note = merge_messages(note, previous_assignment, existing_message)

            try:
                with transaction.atomic():
                    routing = PackageRouting.objects.select_for_update().filter(package_id=o.package_id, tenant_id=tid).first()
                    target_provider_type = 'internal_codes' if provider_is_codes else 'external'
                    routing_changed_fields: list[str] = []
                    original_routing: dict[str, object] = {}

                    if routing:
                        original_routing = {
                            'mode': routing.mode,
                            'provider_type': routing.provider_type,
                            'primary_provider_id': routing.primary_provider_id,
                        }

                        if routing.mode != 'auto':
                            routing.mode = 'auto'
                            routing_changed_fields.append('mode')

                        current_provider_type = (routing.provider_type or '').strip().lower()
                        if current_provider_type != target_provider_type:
                            routing.provider_type = target_provider_type
                            routing_changed_fields.append('provider_type')

                        if not provider_is_codes:
                            desired_provider_id = provider_id
                            if str(routing.primary_provider_id or '').strip() != desired_provider_id:
                                routing.primary_provider_id = desired_provider_id
                                routing_changed_fields.append('primary_provider_id')

                        if routing_changed_fields:
                            routing.save(update_fields=list(dict.fromkeys(routing_changed_fields)))
                    elif provider_is_codes:
                        results.append({ 'id': oid, 'success': False, 'message': 'code routing missing' })
                        continue
                    else:
                        # No routing exists for non-codes provider - this will cause dispatch to fail
                        results.append({ 'id': oid, 'success': False, 'message': 'PackageRouting not found for this package' })
                        continue

                    try:
                        try_auto_dispatch(str(o.id), str(tid))
                        
                        # If auto-dispatch didn't set provider_id, set it manually
                        refreshed_order = ProductOrder.objects.get(id=oid, tenant_id=tid)
                        if not refreshed_order.provider_id and not provider_is_codes:
                            print(f"   [FIX] Auto-dispatch didn't set provider_id, setting manually")
                            refreshed_order.provider_id = provider_id
                            refreshed_order.save(update_fields=['provider_id'])
                        
                    finally:
                        if routing and routing_changed_fields:
                            routing.mode = original_routing['mode']
                            routing.provider_type = original_routing['provider_type']
                            routing.primary_provider_id = original_routing['primary_provider_id']
                            routing.save(update_fields=list(dict.fromkeys(routing_changed_fields)))
            except Exception as exc:
                error_msg = str(exc) if exc else 'dispatch failed'
                # Include exception type for better debugging
                if exc and type(exc).__name__ != 'Exception':
                    error_msg = f'{type(exc).__name__}: {error_msg}'
                # Log the full exception for debugging
                logger.exception('AdminOrdersBulkDispatchView: dispatch failed', extra={'order_id': str(oid), 'provider_id': provider_id})
                results.append({ 'id': oid, 'success': False, 'message': error_msg or 'dispatch failed' })
                continue

            refreshed = ProductOrder.objects.get(id=oid, tenant_id=tid)

            if provider_is_codes:
                success = refreshed.status == 'approved' and (refreshed.manual_note or '').strip()
            else:
                success = str(refreshed.provider_id or '').strip() == provider_id and bool((refreshed.external_order_id or '').strip())

            if not success:
                # Build detailed error message
                error_details = []
                if not str(refreshed.provider_id or '').strip():
                    error_details.append('provider_id not set')
                elif str(refreshed.provider_id or '').strip() != provider_id:
                    error_details.append(f'provider_id mismatch: expected {provider_id}, got {refreshed.provider_id}')
                if not bool((refreshed.external_order_id or '').strip()):
                    error_details.append('external_order_id not set')
                
                # Check if there's a provider message with error
                provider_msg = (refreshed.provider_message or '').strip()
                if provider_msg and any(word in provider_msg.lower() for word in ['error', 'failed', 'فشل', 'خطأ']):
                    error_details.append(f'provider error: {provider_msg[:100]}')
                
                error_message = 'dispatch failed: ' + ', '.join(error_details) if error_details else 'dispatch failed'
                results.append({ 'id': oid, 'success': False, 'message': error_message })
                continue

            merged_message = merge_messages(combined_admin_note, refreshed.provider_message)
            if merged_message and merged_message != (refreshed.provider_message or '').strip():
                ProductOrder.objects.filter(id=oid).update(provider_message=merged_message[:500])

            if feature_enabled:
                marker_provider = provider_id if not provider_is_codes else CODES_PROVIDER_ID
                marker_text = f"ADMIN_REROUTE:{marker_provider}"
                notes_snapshot = list(getattr(refreshed, 'notes', []) or [])
                marker_exists = any(
                    marker_text in (entry.get('text') if isinstance(entry, dict) else str(entry))
                    for entry in notes_snapshot
                )
                if not marker_exists:
                    try:
                        _append_system_note(refreshed, marker_text)
                    except Exception:
                        logger.warning('Failed to append ADMIN_REROUTE system note', extra={'order_id': str(refreshed.id)})

            results.append({ 'id': oid, 'success': True })
        ok_count = len([r for r in results if r.get('success')])
        return Response({ 'ok': True, 'count': ok_count, 'results': results })
