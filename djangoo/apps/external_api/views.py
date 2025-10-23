from __future__ import annotations

import secrets
import json
from django.db import connection
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError, NotFound
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample

from .models import TenantApiToken, IdempotencyKey
from .serializers import TenantApiTokenSerializer, CreateTokenRequest, RotateTokenRequest
from .utils import hash_token, token_prefix, SimpleRateLimiter, idempotency_key
from apps.orders.models import ProductOrder


def _require_admin(user):
    role = getattr(user, 'role', None)
    if role not in ('admin', 'developer', 'instance_owner', 'distributor') and not getattr(user, 'is_superuser', False):
        raise PermissionDenied('INSUFFICIENT_ROLE')


class AdminTenantTokensView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Admin Tokens"], parameters=[
        OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER),
        OpenApiParameter(name='tenantId', required=False, type=str),
        OpenApiParameter(name='userId', required=False, type=str),
    ], responses={200: TenantApiTokenSerializer(many=True)})
    def get(self, request):
        _require_admin(request.user)
        tenant_id = request.query_params.get('tenantId') or getattr(request.user, 'tenant_id', None)
        user_id = request.query_params.get('userId')
        qs = TenantApiToken.objects.all()
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        if user_id:
            qs = qs.filter(user_id=user_id)
        qs = qs.order_by('-created_at')
        return Response(TenantApiTokenSerializer(qs, many=True).data)

    @extend_schema(tags=["Admin Tokens"], request=CreateTokenRequest, responses={201: TenantApiTokenSerializer}, description="Returns tokenPrefix and plain token in body once")
    def post(self, request):
        _require_admin(request.user)
        d = CreateTokenRequest(data=request.data)
        d.is_valid(raise_exception=True)
        payload = d.validated_data
        tenant_id = getattr(request.user, 'tenant_id', None)
        if not tenant_id:
            raise ValidationError('TENANT_REQUIRED')
        plain = secrets.token_urlsafe(32)
        th = hash_token(plain)
        tp = token_prefix(plain)
        scopes_json = json.dumps(payload.get('scopes', []))
        with connection.cursor() as c:
            c.execute(
                """
                INSERT INTO tenant_api_tokens (id, "tenantId", "userId", name, "tokenPrefix", "tokenHash", scopes, "expiresAt", "isActive")
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, true)
                RETURNING id
                """,
                [str(tenant_id), str(payload['user_id']), payload.get('name'), tp, th, scopes_json, payload.get('expires_at')]
            )
            new_id = c.fetchone()[0]
        obj = TenantApiToken.objects.get(id=new_id)
        data = TenantApiTokenSerializer(obj).data
        data['token'] = plain
        return Response(data, status=201)


class AdminTenantTokenDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Admin Tokens"], request=RotateTokenRequest, responses={200: TenantApiTokenSerializer})
    def patch(self, request, token_id: str):
        _require_admin(request.user)
        try:
            obj = TenantApiToken.objects.get(id=token_id)
        except TenantApiToken.DoesNotExist:
            raise NotFound()
        d = RotateTokenRequest(data=request.data)
        d.is_valid(raise_exception=True)
        payload = d.validated_data
        sets, params = [], []
        if 'is_active' in payload:
            sets.append('"isActive"=%s'); params.append(payload['is_active'])
        if 'expires_at' in payload:
            sets.append('"expiresAt"=%s'); params.append(payload['expires_at'])
        if not sets:
            return Response(TenantApiTokenSerializer(obj).data)
        params.append(token_id)
        with connection.cursor() as c:
            c.execute(f"UPDATE tenant_api_tokens SET {', '.join(sets)} WHERE id=%s", params)
        obj.refresh_from_db()
        return Response(TenantApiTokenSerializer(obj).data)

    @extend_schema(tags=["Admin Tokens"], responses={204: None})
    def delete(self, request, token_id: str):
        _require_admin(request.user)
        with connection.cursor() as c:
            c.execute("DELETE FROM tenant_api_tokens WHERE id=%s", [token_id])
        return Response(status=204)


class ExternalAuthGuard(APIView):
    permission_classes = [AllowAny]

    def _authenticate(self, request) -> TenantApiToken:
        token = request.META.get('HTTP_X_API_TOKEN') or request.META.get('HTTP_API_TOKEN')
        if not token:
            raise AuthenticationFailed('API_TOKEN_REQUIRED')
        th = hash_token(token)
        tp = token_prefix(token)
        try:
            t = TenantApiToken.objects.get(token_prefix=tp, token_hash=th, is_active=True)
        except TenantApiToken.DoesNotExist:
            raise AuthenticationFailed('INVALID_API_TOKEN')
        # Rate limit per token
        limiter = SimpleRateLimiter(key=f"token:{t.id}", limit=60, window_seconds=60)
        if not limiter.allow():
            raise PermissionDenied('RATE_LIMITED')
        # Set attrs
        request.external_token = t
        return t


class ExternalOrdersCreateView(ExternalAuthGuard):
    @extend_schema(
        tags=["External API"],
        parameters=[
            OpenApiParameter(
                name='X-API-Token', required=True, type=str, location=OpenApiParameter.HEADER,
                description='Provide the plain API token',
                examples=[OpenApiExample('token', value='tok_abc123...')]
            ),
            OpenApiParameter(
                name='Idempotency-Key', required=False, type=str, location=OpenApiParameter.HEADER,
                description='Any unique string per request to avoid duplicates',
                examples=[OpenApiExample('idem', value='req_20240918_001')]
            ),
        ],
        request=None,
        responses={201: dict},
        description="Creates a ProductOrder and ties it to Idempotency-Key if provided."
    )
    def post(self, request):
        t = self._authenticate(request)
        idem_key = request.headers.get('Idempotency-Key')
        body = request.body or b''
        req_hash = hash_token(body.decode('utf-8', errors='ignore'))
        # Check idempotency pre-existence
        if idem_key:
            try:
                existed = IdempotencyKey.objects.get(token_id=t.id, key=idem_key, request_hash=req_hash)
                if existed.order_id:
                    try:
                        po = ProductOrder.objects.get(id=existed.order_id)
                        return Response({ 'ok': True, 'orderId': str(po.id), 'idempotent': True }, status=201)
                    except ProductOrder.DoesNotExist:
                        pass
            except IdempotencyKey.DoesNotExist:
                pass

        # Minimal required fields — pull tenant from token, set defaults
        # ✅ FIX: Set mode='MANUAL' for orders created via External API
        # This indicates the order was received without auto-routing configured
        now = timezone.now()
        with connection.cursor() as c:
            c.execute(
                """
                INSERT INTO product_orders (id, "tenantId", status, quantity, "sellPriceCurrency", "sellPriceAmount", price, "createdAt", "externalStatus", mode)
                VALUES (gen_random_uuid(), %s, 'pending', 1, 'USD', 0, 0, %s, 'not_sent', 'MANUAL')
                RETURNING id
                """,
                [str(t.tenant_id), now]
            )
            order_id = c.fetchone()[0]
        
        # CHAIN FORWARDING COST CALCULATION: Compute cost for intermediate tenant before forwarding
        try:
            from apps.orders.models import ProductOrder
            from apps.orders.services import _compute_manual_cost_snapshot, _persist_cost_snapshot
            from django.conf import settings
            import json
            
            if getattr(settings, 'FF_USD_COST_ENFORCEMENT', False):
                order = ProductOrder.objects.get(id=order_id)
                print(f"💰 Computing intermediate cost for chain forwarding (External API)...")
                cost_snapshot = _compute_manual_cost_snapshot(order)
                _persist_cost_snapshot(
                    order_id=order.id,
                    snapshot=cost_snapshot,
                    quantity=order.quantity or 1,
                    tenant_id=order.tenant_id,
                    mode='MANUAL',
                )
                print(f"✅ Intermediate cost computed: {cost_snapshot.cost_price_usd} USD")
                
                # CHAIN PATH: Set chain path for forwarded orders
                from apps.tenants.models import Tenant
                try:
                    # For forwarded orders (stub-), we need to determine the next tenant
                    if order.external_order_id and order.external_order_id.startswith('stub-'):
                        # This is a forwarded order, we need to find the next tenant
                        # For now, we'll use a placeholder that indicates forwarding
                        chain_path = ["Forwarded"]  # Indicates this order was forwarded
                        order.chain_path = json.dumps(chain_path)
                        order.save(update_fields=['chain_path'])
                        print(f"✅ Chain path set for forwarded order: {chain_path}")
                    else:
                        # Regular order, set current tenant
                        tenant = Tenant.objects.get(id=order.tenant_id)
                        chain_path = [tenant.name]
                        order.chain_path = json.dumps(chain_path)
                        order.save(update_fields=['chain_path'])
                        print(f"✅ Chain path set: {chain_path}")
                except Exception as exc:
                    print(f"⚠️ Failed to set chain path: {exc}")
        except Exception as exc:
            print(f"⚠️ Failed to compute intermediate cost for chain forwarding: {exc}")
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                "Failed to compute intermediate cost for chain forwarding (External API)",
                extra={"order_id": order_id, "error": str(exc)}
            )
        # Update token last used timestamp
        with connection.cursor() as c:
            c.execute('UPDATE tenant_api_tokens SET "lastUsedAt"=%s WHERE id=%s', [now, str(t.id)])

        # Persist idempotency link
        if idem_key:
            with connection.cursor() as c:
                # Try to find existing idempotency row for this exact request
                c.execute(
                    'SELECT id FROM idempotency_keys WHERE "tokenId"=%s AND key=%s AND "requestHash"=%s',
                    [str(t.id), idem_key, req_hash]
                )
                row = c.fetchone()
                if row:
                    c.execute('UPDATE idempotency_keys SET "orderId"=%s WHERE id=%s', [str(order_id), row[0]])
                else:
                    c.execute(
                        'INSERT INTO idempotency_keys (id, "tokenId", key, "requestHash", "orderId", "ttlSeconds") VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)',
                        [str(t.id), idem_key, req_hash, str(order_id), 86400]
                    )

        return Response({ 'ok': True, 'orderId': str(order_id) }, status=201)
