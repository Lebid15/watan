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
from decimal import Decimal
from typing import Optional
from apps.users.models import User
from apps.products.models import ProductPackage
from apps.orders.models import ProductOrder, LegacyUser
import logging

logger = logging.getLogger(__name__)


class ClientApiAuthMixin:
    """
    Mixin for authenticating Client API requests
    Checks for 'api-token' header and validates it
    """
    def authenticate_client_api(self, request):
        """
        Authenticate using api-token header
        Returns: (tenant, user) tuple or raises exception
        """
        api_token = request.headers.get('api-token')
        
        if not api_token:
            return None, None
        
        try:
            # Find user with this token
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

        # Ensure host tenant matches token owner when middleware resolves it
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
            # Legacy tenant model provides code/name for logging (managed=False)
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
        
        # Create order
        try:
            from django.utils import timezone
            import uuid
            
            with transaction.atomic():
                # Calculate prices
                sell_price = Decimal(package.base_price or 0)
                
                # Create order - use create() which works even with managed=False
                legacy_user = self.get_legacy_user(tenant.id, user)

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

                order = ProductOrder.objects.create(
                    id=uuid.uuid4(),
                    tenant_id=tenant.id,
                    user_id=legacy_user.id,
                    product_id=package.product_id,
                    package_id=package.id,
                    quantity=quantity,
                    user_identifier=user_identifier or '',
                    extra_field=extra_field or '',
                    status='pending',
                    sell_price_currency='USD',
                    sell_price_amount=sell_price,
                    price=sell_price * Decimal(quantity),
                    external_status='not_sent',
                    external_order_id=order_uuid or None,
                    provider_referans=order_uuid or None,
                    created_at=timezone.now(),
                    notes={},  # legacy column is NOT NULL
                )
                
                logger.info(f'✅ Client API order created: {order.id} for tenant {tenant.slug}')
                
                return Response({
                    'orderId': str(order.id),
                    'status': order.status,
                    'createdAt': order.created_at.isoformat() if order.created_at else None,
                }, status=status.HTTP_201_CREATED)
                
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
