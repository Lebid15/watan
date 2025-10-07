from __future__ import annotations

import logging
from django.db.models import Q
from django.db import connection, transaction
from django.db.utils import ProgrammingError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import RequireAdminRole
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiParameter
import csv
import math
from django.http import HttpResponse

from .models import ProviderAPI, PackageMapping, Integration, PackageRouting, PackageCost
from django.conf import settings
try:
    from apps.tenants.models import TenantDomain  # type: ignore
except Exception:
    TenantDomain = None
from .adapters import resolve_adapter_credentials
from .serializers import (
    ProviderSerializer,
    ProvidersListResponseSerializer,
    PackageMappingSerializer,
    PackageMappingsListResponseSerializer,
    IntegrationSerializer,
    IntegrationCreateRequest,
    IntegrationUpdateRequest,
    PackageRoutingSerializer,
    PackageRoutingUpsertRequest,
    PackageCostSerializer,
    PackageCostUpsertRequest,
    CoverageResponseSerializer,
)
from apps.products.models import Product, ProductPackage
try:
    from apps.codes.models import CodeGroup  # type: ignore
except Exception:
    CodeGroup = None  # type: ignore


logger = logging.getLogger(__name__)


def _resolve_tenant_id(request) -> str | None:
    # Allow direct override via X-Tenant-Id header for local/testing
    direct_tid = request.META.get('HTTP_X_TENANT_ID')
    if direct_tid:
        return str(direct_tid)
    # Prefer explicit domain mapping when available
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


def _parse_balance_value(value):
    if value is None:
        return None, None
    if isinstance(value, (int, float)):
        try:
            num = float(value)
        except (TypeError, ValueError):
            return None, 'Invalid balance value'
    else:
        s = str(value).strip()
        if not s:
            return None, 'Empty balance value'
        s = s.replace(',', '.')
        try:
            num = float(s)
        except ValueError:
            return None, f'Invalid balance value: {s}'
    if not math.isfinite(num):
        return None, 'Invalid balance value (non-finite)'
    return num, None


def _adapter_balance_result(adapter, creds):
    try:
        res = adapter.get_balance(creds)
    except Exception as exc:  # pragma: no cover - defensive
        return { 'balance': None, 'error': 'FETCH_FAILED', 'message': str(exc) }
    if res is None:
        return { 'balance': None }
    if isinstance(res, dict):
        return res
    return { 'balance': res }


def _build_balance_payload(integration: Integration, *, persist: bool, overrides: dict | None = None) -> dict:
    override_map = overrides or {}
    provider_value = override_map.get('provider') or integration.provider
    binding, creds = resolve_adapter_credentials(
        provider_value,
        base_url=integration.base_url,
        api_token=getattr(integration, 'api_token', None),
        kod=getattr(integration, 'kod', None),
        sifre=getattr(integration, 'sifre', None),
        overrides=override_map or None,
    )
    updated_at = integration.balance_updated_at.isoformat() if integration.balance_updated_at else None
    if not binding:
        return { 'balance': None, 'error': 'ADAPTER_NOT_AVAILABLE', 'balanceUpdatedAt': updated_at }
    result = _adapter_balance_result(binding.adapter, creds)

    message = result.get('message')
    if message is not None:
        message = str(message)
    missing_config = bool(result.get('missingConfig'))
    raw_error = result.get('error')
    if raw_error is not None:
        raw_error = str(raw_error)

    balance_value, parse_error = _parse_balance_value(result.get('balance'))

    payload: dict = {}
    if missing_config:
        payload['missingConfig'] = True

    error_text = raw_error
    if parse_error and not error_text:
        error_text = 'INVALID_BALANCE'
        message = parse_error
    if error_text:
        payload['error'] = error_text
    if message:
        payload['message'] = message[:200]
    if result.get('currency') is not None:
        payload['currency'] = result.get('currency')

    has_error = bool(error_text)
    response_balance = None if has_error or missing_config or balance_value is None else balance_value

    allow_persist = persist and not bool(override_map)
    if allow_persist and response_balance is not None and response_balance != 0:
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE integrations SET balance=%s, "balanceUpdatedAt"=NOW() WHERE id=%s',
                [response_balance, integration.id]
            )
        integration.refresh_from_db()
        try:
            response_balance = float(integration.balance) if integration.balance is not None else response_balance
        except (TypeError, ValueError):
            response_balance = response_balance

    payload['balance'] = response_balance
    payload['balanceUpdatedAt'] = integration.balance_updated_at.isoformat() if integration.balance_updated_at else None
    return payload


class AdminProvidersListView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Providers"],
        parameters=[
            OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER),
        ],
        responses={200: ProvidersListResponseSerializer}
    )
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        qs = ProviderAPI.objects.filter(tenant_id=tenant_id, is_active=True).order_by('name')
        return Response({ 'items': ProviderSerializer(qs, many=True).data })


class AdminProviderDetailsView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Providers"], responses={200: ProviderSerializer})
    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            p = ProviderAPI.objects.get(id=id)
        except ProviderAPI.DoesNotExist:
            raise NotFound('المزوّد غير موجود')
        if str(p.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذا المزوّد')
        return Response(ProviderSerializer(p).data)


class AdminPackageMappingsListView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Providers"],
        parameters=[
            OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER),
            OpenApiParameter(name='limit', required=False, type=int),
            OpenApiParameter(name='cursor', required=False, type=str),
            OpenApiParameter(name='providerApiId', required=False, type=str),
            OpenApiParameter(name='ourPackageId', required=False, type=str),
        ],
        responses={200: PackageMappingsListResponseSerializer}
    )
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        limit = int(request.query_params.get('limit') or 50)
        limit = max(1, min(limit, 200))
        cursor = request.query_params.get('cursor') or None
        provider_api_id = (request.query_params.get('providerApiId') or '').strip()
        our_package_id = (request.query_params.get('ourPackageId') or '').strip()

        qs = PackageMapping.objects.filter(tenant_id=tenant_id).order_by('-created_at')
        if provider_api_id:
            qs = qs.filter(provider_api_id=provider_api_id)
        if our_package_id:
            qs = qs.filter(our_package_id=our_package_id)
        if cursor:
            try:
                qs = qs.filter(created_at__lt=cursor)
            except Exception:
                pass
        items = list(qs[: limit + 1])
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None
        return Response({ 'items': PackageMappingSerializer(items, many=True).data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more } })


class AdminIntegrationsListCreateView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Integrations"],
        parameters=[OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER)],
        responses={200: IntegrationSerializer(many=True)}
    )
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        qs = Integration.objects.filter(tenant_id=tenant_id).order_by('name')
        return Response(IntegrationSerializer(qs, many=True).data)

    @extend_schema(tags=["Admin Integrations"], request=IntegrationCreateRequest, responses={201: IntegrationSerializer})
    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        d = IntegrationCreateRequest(data=request.data)
        d.is_valid(raise_exception=True)
        v = d.validated_data
        with connection.cursor() as c:
            c.execute(
                '''INSERT INTO integrations (id, "tenantId", name, provider, scope, "baseUrl", "apiToken", kod, sifre, enabled)
                   VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
                [tenant_id, v['name'], v['provider'], v.get('scope') or 'tenant', v.get('baseUrl'), v.get('apiToken'), v.get('kod'), v.get('sifre'), bool(v.get('enabled', True))]
            )
            new_id = c.fetchone()[0]
        obj = Integration.objects.get(id=new_id)
        return Response(IntegrationSerializer(obj).data, status=201)


class AdminIntegrationDetailView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Integrations"], responses={200: IntegrationSerializer})
    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            obj = Integration.objects.get(id=id)
        except Integration.DoesNotExist:
            raise NotFound('التكامل غير موجود')
        if str(obj.tenant_id) != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا التكامل')
        integration_id = str(obj.id)
        return Response(IntegrationSerializer(obj).data)

    @extend_schema(tags=["Admin Integrations"], request=IntegrationUpdateRequest, responses={200: IntegrationSerializer})
    def patch(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            obj = Integration.objects.get(id=id)
        except Integration.DoesNotExist:
            raise NotFound('التكامل غير موجود')
        if str(obj.tenant_id) != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا التكامل')
        d = IntegrationUpdateRequest(data=request.data)
        d.is_valid(raise_exception=True)
        v = d.validated_data
        sets, params = [], []
        for key, col in [('baseUrl','baseUrl'), ('apiToken','apiToken'), ('kod','kod'), ('sifre','sifre'), ('enabled','enabled')]:
            if key in v:
                sets.append(f'"{col}"=%s'); params.append(v[key])
        if sets:
            params.append(id)
            with connection.cursor() as c:
                c.execute(f'UPDATE integrations SET {", ".join(sets)} WHERE id=%s', params)
        obj.refresh_from_db()
        return Response(IntegrationSerializer(obj).data)

    def put(self, request, id: str):
        return self.patch(request, id)

    @extend_schema(tags=["Admin Integrations"], responses={204: None})
    def delete(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        with connection.cursor() as c:
            c.execute('DELETE FROM integrations WHERE id=%s AND "tenantId"=%s', [id, tenant_id])
        return Response(status=204)


class AdminRoutingGetUpsertView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def _ensure_tenant(self, request, routing: PackageRouting | None, tenant_id: str):
        if routing and str(routing.tenant_id) != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا التوجيه')

    @extend_schema(tags=["Admin Routing"], responses={200: PackageRoutingSerializer})
    def get(self, request, package_id: str):
        tenant_id = _resolve_tenant_id(request) or ''
        try:
            r = PackageRouting.objects.get(tenant_id=tenant_id, package_id=package_id)
        except PackageRouting.DoesNotExist:
            return Response({})
        return Response(PackageRoutingSerializer(r).data)

    @extend_schema(tags=["Admin Routing"], request=PackageRoutingUpsertRequest, responses={200: PackageRoutingSerializer})
    def put(self, request, package_id: str):
        tenant_id = _resolve_tenant_id(request) or ''
        d = PackageRoutingUpsertRequest(data=request.data)
        d.is_valid(raise_exception=True)
        v = d.validated_data
        # upsert
        with connection.cursor() as c:
            c.execute('SELECT id FROM package_routing WHERE "tenantId"=%s AND package_id=%s', [tenant_id, package_id])
            row = c.fetchone()
            if row:
                c.execute('UPDATE package_routing SET mode=%s, "providerType"=%s, "primaryProviderId"=%s, "fallbackProviderId"=%s, "codeGroupId"=%s WHERE id=%s',
                          [v['mode'], v['providerType'], v.get('primaryProviderId'), v.get('fallbackProviderId'), v.get('codeGroupId'), row[0]])
                rid = row[0]
            else:
                c.execute('INSERT INTO package_routing (id, "tenantId", package_id, mode, "providerType", "primaryProviderId", "fallbackProviderId", "codeGroupId") VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s) RETURNING id',
                          [tenant_id, package_id, v['mode'], v['providerType'], v.get('primaryProviderId'), v.get('fallbackProviderId'), v.get('codeGroupId')])
                rid = c.fetchone()[0]
        obj = PackageRouting.objects.get(id=rid)
        return Response(PackageRoutingSerializer(obj).data)


class AdminRoutingAllView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Routing"], responses={200: dict})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request) or ''
        q = (request.query_params.get('q') or '').strip().lower()

        # If required tables are missing (fresh DB or different schema), return empty sets gracefully
        try:
            existing_tables = set(connection.introspection.table_names())
        except Exception:
            existing_tables = set()
        required = {'product_packages', 'product'}
        if not required.issubset(existing_tables):
            return Response({ 'providers': [], 'codeGroups': [], 'items': [] })

        # Providers list for selection (optional if table exists)
        providers = []
        providers_map = {}
        if 'integrations' in existing_tables:
            try:
                providers = list(
                    Integration.objects
                    .filter(tenant_id=tenant_id, enabled=True)
                    .order_by('name')
                )
                providers_map = {str(p.id): p for p in providers}
            except Exception:
                providers = []
                providers_map = {}
        elif 'provider_api' in existing_tables:
            # Fallback to legacy table in case integrations are not yet migrated
            try:
                providers = list(ProviderAPI.objects.filter(tenant_id=tenant_id).order_by('name'))
                providers_map = {str(p.id): p for p in providers}
            except Exception:
                providers = []
                providers_map = {}

        # Code groups for internal_codes option (tolerate missing table in early setups)
        try:
            if CodeGroup is not None:
                groups = list(CodeGroup.objects.filter(tenant_id=tenant_id, is_active=True).order_by('name'))
            else:
                groups = []
        except Exception:
            groups = []

        # Fetch packages visible to tenant (public_code not null and active)
        pkg_qs = (
            ProductPackage.objects
            .filter(tenant_id=tenant_id, public_code__isnull=False, is_active=True)
            .order_by('name')
        )
        pkg_rows = list(pkg_qs.values('id','name','public_code','product_id','base_price')[:2000])
        prod_ids = [row['product_id'] for row in pkg_rows if row.get('product_id')]
        prod_map = { str(p['id']): p['name'] for p in Product.objects.filter(id__in=prod_ids).values('id','name') }
        items = []
        # Preload routing and costs
        pkg_ids = [row['id'] for row in pkg_rows]
        routings = {}
        if 'package_routing' in existing_tables:
            try:
                routings = { (str(r.package_id)): r for r in PackageRouting.objects.filter(tenant_id=tenant_id, package_id__in=pkg_ids) }
            except Exception:
                routings = {}
        costs = {}
        costs_map = {}
        if 'package_costs' in existing_tables:
            try:
                qs = PackageCost.objects.filter(tenant_id=tenant_id, package_id__in=pkg_ids)
            except Exception:
                try:
                    qs = PackageCost.objects.filter(package_id__in=pkg_ids)
                except Exception:
                    qs = []
            for pc in qs:
                pkg_key = str(pc.package_id)
                prov_key = str(pc.provider_id)
                costs.setdefault(pkg_key, []).append(pc)
                costs_map[(pkg_key, prov_key)] = pc

        for row in pkg_rows:
            pkg_id = str(row['id'])
            prod_name = prod_map.get(str(row.get('product_id')), None)
            if q:
                base = f"{(prod_name or '')} {(row.get('name') or '')}"
                if q not in base.lower():
                    continue
            routing = routings.get(pkg_id)
            routing_obj = {
                'mode': getattr(routing, 'mode', 'manual'),
                'primaryProviderId': getattr(routing, 'primary_provider_id', None),
                'fallbackProviderId': getattr(routing, 'fallback_provider_id', None),
                'providerType': getattr(routing, 'provider_type', 'manual'),
                'codeGroupId': getattr(routing, 'code_group_id', None),
            }
            prov_costs = []
            known_provider_ids = set()
            for provider in providers:
                pid = str(provider.id)
                known_provider_ids.add(pid)
                cost = costs_map.get((pkg_id, pid))
                prov_costs.append({
                    'providerId': pid,
                    'providerName': provider.name,
                    'costCurrency': getattr(cost, 'cost_currency', 'USD'),
                    'costAmount': float(getattr(cost, 'cost_amount', 0) or 0),
                })

            # Preserve any legacy costs tied to providers no longer present
            for c in costs.get(pkg_id, []) or []:
                prov_id = str(c.provider_id)
                if prov_id in known_provider_ids:
                    continue
                p = providers_map.get(prov_id)
                prov_costs.append({
                    'providerId': prov_id,
                    'providerName': getattr(p, 'name', prov_id),
                    'costCurrency': c.cost_currency,
                    'costAmount': float(c.cost_amount or 0),
                })
            items.append({
                'packageId': pkg_id,
                'publicCode': row.get('public_code'),
                'productName': prod_name,
                'packageName': row.get('name'),
                'basePrice': float(row.get('base_price') or 0),
                'routing': routing_obj,
                'providers': prov_costs,
            })

        return Response({
            'providers': [{ 'id': str(p.id), 'name': p.name, 'type': getattr(p, 'provider', 'external') } for p in providers],
            'codeGroups': [{ 'id': str(g.id), 'name': g.name } for g in groups],
            'items': items,
        })


class AdminRoutingSetProviderView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Routing"], request=dict, responses={200: dict})
    def post(self, request):
        tenant_id = _resolve_tenant_id(request) or ''
        package_id = (request.data.get('packageId') or '').strip()
        which = (request.data.get('which') or '').strip()
        provider_id = request.data.get('providerId')
        if which not in ('primary','fallback'):
            raise ValidationError('which must be primary or fallback')
        if not package_id:
            raise ValidationError('packageId مطلوب')
        col = 'primaryProviderId' if which == 'primary' else 'fallbackProviderId'
        with connection.cursor() as c:
            c.execute('SELECT id FROM package_routing WHERE "tenantId"=%s AND package_id=%s', [tenant_id, package_id])
            row = c.fetchone()
            if row:
                c.execute(f'UPDATE package_routing SET "{col}"=%s WHERE id=%s', [provider_id, row[0]])
            else:
                # default providerType to external if provider provided, else manual
                ptype = 'external' if provider_id else 'manual'
                c.execute(f'INSERT INTO package_routing (id, "tenantId", package_id, mode, "providerType", "{col}") VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)', [tenant_id, package_id, 'auto' if ptype!='manual' else 'manual', ptype, provider_id])
        return Response({'ok': True})


class AdminRoutingSetTypeView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Routing"], request=dict, responses={200: dict})
    def post(self, request):
        tenant_id = _resolve_tenant_id(request) or ''
        package_id = (request.data.get('packageId') or '').strip()
        provider_type = (request.data.get('providerType') or '').strip()
        if provider_type not in ('manual','external','internal_codes'):
            raise ValidationError('providerType غير صالح')
        if not package_id:
            raise ValidationError('packageId مطلوب')
        mode = 'manual' if provider_type == 'manual' else 'auto'
        with connection.cursor() as c:
            c.execute('SELECT id FROM package_routing WHERE "tenantId"=%s AND package_id=%s', [tenant_id, package_id])
            row = c.fetchone()
            if row:
                c.execute('UPDATE package_routing SET mode=%s, "providerType"=%s WHERE id=%s', [mode, provider_type, row[0]])
            else:
                c.execute('INSERT INTO package_routing (id, "tenantId", package_id, mode, "providerType") VALUES (gen_random_uuid(), %s, %s, %s, %s)', [tenant_id, package_id, mode, provider_type])
        return Response({'ok': True})


class AdminRoutingSetCodeGroupView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Routing"], request=dict, responses={200: dict})
    def post(self, request):
        tenant_id = _resolve_tenant_id(request) or ''
        package_id = (request.data.get('packageId') or '').strip()
        code_group_id = request.data.get('codeGroupId')
        if not package_id:
            raise ValidationError('packageId مطلوب')
        provider_type = 'internal_codes' if code_group_id else 'manual'
        mode = 'auto' if code_group_id else 'manual'
        with connection.cursor() as c:
            c.execute('SELECT id FROM package_routing WHERE "tenantId"=%s AND package_id=%s', [tenant_id, package_id])
            row = c.fetchone()
            if row:
                c.execute('UPDATE package_routing SET "providerType"=%s, mode=%s, "codeGroupId"=%s, "primaryProviderId"=NULL, "fallbackProviderId"=NULL WHERE id=%s', [provider_type, mode, code_group_id, row[0]])
            else:
                c.execute('INSERT INTO package_routing (id, "tenantId", package_id, mode, "providerType", "codeGroupId") VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)', [tenant_id, package_id, mode, provider_type, code_group_id])
        return Response({'ok': True})


class AdminProviderCostView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Integrations"], request=dict, responses={200: dict})
    def post(self, request):
        tenant_id = _resolve_tenant_id(request) or ''
        package_id = (request.data.get('packageId') or '').strip()
        provider_id = (request.data.get('providerId') or '').strip()
        if not package_id or not provider_id:
            raise ValidationError('packageId و providerId مطلوبة')
        try:
            integration = Integration.objects.get(id=provider_id)
        except Integration.DoesNotExist:
            raise NotFound('المزوّد غير موجود')
        if str(integration.tenant_id or '') != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا المزوّد')

        try:
            mapping = PackageMapping.objects.filter(
                tenant_id=tenant_id,
                our_package_id=package_id,
                provider_api_id=provider_id,
            ).first()
        except Exception:
            mapping = PackageMapping.objects.filter(
                our_package_id=package_id,
                provider_api_id=provider_id,
            ).first()

        if not mapping:
            return Response({
                'mapped': False,
                'message': 'لا يوجد ربط لهذه الباقة مع هذا المزوّد. اذهب لإعدادات API ثم اربط الباقة.',
            })

        binding, creds = resolve_adapter_credentials(
            integration.provider,
            base_url=integration.base_url,
            api_token=getattr(integration, 'api_token', None),
            kod=getattr(integration, 'kod', None),
            sifre=getattr(integration, 'sifre', None),
        )
        if not binding:
            return Response({
                'mapped': True,
                'message': 'لا يوجد Adapter متاح لهذا المزوّد بعد.',
            }, status=400)

        try:
            products = binding.adapter.list_products(creds) or []
        except Exception as exc:
            return Response({
                'mapped': True,
                'message': f'تعذر جلب باقات المزوّد: {str(exc)[:200]}',
            }, status=502)

        provider_pkg_id = str(getattr(mapping, 'provider_package_id', '') or '')
        match: dict | None = None
        for item in products:
            if not isinstance(item, dict):
                continue
            ext = item.get('externalId') or item.get('id') or item.get('packageExternalId')
            if ext is None:
                continue
            if str(ext) == provider_pkg_id:
                match = item
                break

        if not match:
            return Response({
                'mapped': True,
                'message': 'تعذر إيجاد باقة المزوّد بناءً على الربط. تأكد من صحة الربط.',
            })

        raw_amount = match.get('basePrice')
        if raw_amount is None:
            raw_amount = match.get('costPrice')
        try:
            cost_amount = float(raw_amount)
        except (TypeError, ValueError):
            cost_amount = 0.0

        currency = (
            match.get('currencyCode')
            or match.get('currency')
            or (match.get('meta') or {}).get('currency')  # type: ignore[union-attr]
        )
        if not currency:
            currency = 'USD'

        saved_id = None
        has_tenant_column = True
        with connection.cursor() as cursor:
            try:
                cursor.execute(
                    'SELECT id FROM package_costs WHERE "tenantId"=%s AND package_id=%s AND "providerId"=%s',
                    [tenant_id, package_id, provider_id],
                )
                row = cursor.fetchone()
            except ProgrammingError:
                has_tenant_column = False
                cursor.execute(
                    'SELECT id FROM package_costs WHERE package_id=%s AND "providerId"=%s',
                    [package_id, provider_id],
                )
                row = cursor.fetchone()

            if row:
                saved_id = row[0]
                cursor.execute(
                    'UPDATE package_costs SET "costCurrency"=%s, "costAmount"=%s WHERE id=%s',
                    [currency, cost_amount, saved_id],
                )
            else:
                if has_tenant_column:
                    try:
                        cursor.execute(
                            'INSERT INTO package_costs (id, "tenantId", package_id, "providerId", "costCurrency", "costAmount") VALUES (gen_random_uuid(), %s, %s, %s, %s, %s) RETURNING id',
                            [tenant_id, package_id, provider_id, currency, cost_amount],
                        )
                        saved_id = cursor.fetchone()[0]
                    except ProgrammingError:
                        has_tenant_column = False
                if not has_tenant_column:
                    cursor.execute(
                        'INSERT INTO package_costs (id, package_id, "providerId", "costCurrency", "costAmount") VALUES (gen_random_uuid(), %s, %s, %s, %s) RETURNING id',
                        [package_id, provider_id, currency, cost_amount],
                    )
                    saved_id = cursor.fetchone()[0]

        return Response({
            'mapped': True,
            'cost': {
                'amount': float(cost_amount),
                'currency': currency,
            },
            'message': 'تم تحديث تكلفة المزوّد لهذه الباقة.',
            'packageId': package_id,
            'providerId': provider_id,
            'costId': saved_id,
        })


class AdminPackageCostsListUpsertDeleteView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Costs"], parameters=[OpenApiParameter('packageId', required=True, type=str)], responses={200: PackageCostSerializer(many=True)})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request) or ''
        package_id = (request.query_params.get('packageId') or '').strip()
        if not package_id:
            raise ValidationError('packageId مطلوب')
        qs = PackageCost.objects.filter(tenant_id=tenant_id, package_id=package_id).order_by('provider_id')
        return Response(PackageCostSerializer(qs, many=True).data)

    @extend_schema(tags=["Admin Costs"], request=PackageCostUpsertRequest, responses={200: PackageCostSerializer})
    def put(self, request):
        tenant_id = _resolve_tenant_id(request) or ''
        package_id = (request.query_params.get('packageId') or '').strip()
        if not package_id:
            raise ValidationError('packageId مطلوب')
        d = PackageCostUpsertRequest(data=request.data)
        d.is_valid(raise_exception=True)
        v = d.validated_data
        with connection.cursor() as c:
            c.execute('SELECT id FROM package_costs WHERE "tenantId"=%s AND package_id=%s AND "providerId"=%s', [tenant_id, package_id, v['providerId']])
            row = c.fetchone()
            if row:
                c.execute('UPDATE package_costs SET "costCurrency"=%s, "costAmount"=%s WHERE id=%s', [v['costCurrency'], v['costAmount'], row[0]])
                cid = row[0]
            else:
                c.execute('INSERT INTO package_costs (id, "tenantId", package_id, "providerId", "costCurrency", "costAmount") VALUES (gen_random_uuid(), %s, %s, %s, %s, %s) RETURNING id', [tenant_id, package_id, v['providerId'], v['costCurrency'], v['costAmount']])
                cid = c.fetchone()[0]
        obj = PackageCost.objects.get(id=cid)
        return Response(PackageCostSerializer(obj).data)

    @extend_schema(tags=["Admin Costs"], parameters=[OpenApiParameter('packageId', required=True, type=str), OpenApiParameter('providerId', required=True, type=str)], responses={204: None})
    def delete(self, request):
        tenant_id = _resolve_tenant_id(request) or ''
        package_id = (request.query_params.get('packageId') or '').strip()
        provider_id = (request.query_params.get('providerId') or '').strip()
        if not package_id or not provider_id:
            raise ValidationError('packageId و providerId مطلوبة')
        with connection.cursor() as c:
            c.execute('DELETE FROM package_costs WHERE "tenantId"=%s AND package_id=%s AND "providerId"=%s', [tenant_id, package_id, provider_id])
        return Response(status=204)


class AdminIntegrationPackagesView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Integrations"],
        parameters=[OpenApiParameter('product', required=False, type=str)],
        responses={200: dict},
    )
    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request) or ''
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            obj = Integration.objects.get(id=id)
        except Integration.DoesNotExist:
            raise NotFound('التكامل غير موجود')
        if str(obj.tenant_id) != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا التكامل')
        integration_id = str(obj.id)

        product_filter = (request.query_params.get('product') or '').strip()

        try:
            tables = set(connection.introspection.table_names())
        except Exception:
            tables = set()

        our_packages: list[ProductPackage] = []
        if {'product_packages', 'product'}.issubset(tables):
            qs = (
                ProductPackage.objects
                .filter(tenant_id=tenant_id, is_active=True)
                .select_related('product')
            )
            if product_filter:
                qs = qs.filter(product__name__icontains=product_filter)
            our_packages = list(qs.order_by('product__name', 'name'))
        else:
            our_packages = []

        binding, creds = resolve_adapter_credentials(
            obj.provider,
            base_url=obj.base_url,
            api_token=getattr(obj, 'api_token', None),
            kod=getattr(obj, 'kod', None),
            sifre=getattr(obj, 'sifre', None),
        )
        adapter = binding.adapter if binding else None
        provider_items: list[dict] = []
        provider_options: list[dict] = []
        provider_map: dict[str, dict] = {}
        if adapter:
            try:
                provider_items = adapter.list_products(creds) or []
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning('Failed to list provider products', extra={'integration_id': str(obj.id), 'provider': obj.provider, 'reason': str(exc)[:120]})
                provider_items = []
        for item in provider_items:
            if not isinstance(item, dict):
                continue
            external_id = item.get('externalId') or item.get('id')
            if not external_id:
                continue
            external_id = str(external_id)
            provider_map[external_id] = item
            price_raw = item.get('basePrice')
            try:
                price_value = float(price_raw)
            except (TypeError, ValueError):
                price_value = 0.0
            currency = item.get('currencyCode')
            if not currency and isinstance(item.get('meta'), dict):
                currency = item['meta'].get('currency') or item['meta'].get('currencyCode')
            provider_options.append({
                'id': external_id,
                'name': item.get('name') or f'Package {external_id}',
                'price': price_value,
                'currency': currency,
            })

        try:
            mapping_qs = PackageMapping.objects.filter(provider_api_id=integration_id, tenant_id=tenant_id)
        except ProgrammingError:
            mapping_qs = PackageMapping.objects.filter(provider_api_id=integration_id)
        mapping_map: dict[str, str | None] = {}
        for m in mapping_qs:
            key = str(getattr(m, 'our_package_id', ''))
            value = getattr(m, 'provider_package_id', None)
            mapping_map[key] = str(value) if value is not None else None

        packages_payload: list[dict] = []
        for pkg in our_packages:
            pkg_id = str(pkg.id)
            mapping_id = mapping_map.get(pkg_id)
            provider_pkg = provider_map.get(mapping_id) if mapping_id else None
            provider_price = None
            if provider_pkg is not None:
                try:
                    provider_price = float(provider_pkg.get('basePrice'))
                except (TypeError, ValueError):
                    provider_price = None
            packages_payload.append({
                'our_package_id': pkg_id,
                'our_package_name': pkg.name or '',
                'our_base_price': float(pkg.base_price or 0),
                'provider_price': provider_price,
                'current_mapping': mapping_id,
                'provider_packages': provider_options,
            })

        balance_payload = _build_balance_payload(obj, persist=False)
        api_info = {
            'id': str(obj.id),
            'name': obj.name,
            'type': obj.provider,
            'balance': balance_payload.get('balance'),
        }
        return Response({'api': api_info, 'packages': packages_payload})

    @extend_schema(
        tags=["Admin Integrations"],
        request=dict,
        responses={200: dict},
    )
    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request) or ''
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            obj = Integration.objects.get(id=id)
        except Integration.DoesNotExist:
            raise NotFound('التكامل غير موجود')
        if str(obj.tenant_id) != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا التكامل')
        integration_id = str(obj.id)

        payload = request.data
        if not isinstance(payload, list):
            raise ValidationError('Body must be an array of mappings')

        cleaned: list[tuple[str, str]] = []
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            our_id = str(entry.get('our_package_id') or '').strip()
            provider_id = str(entry.get('provider_package_id') or '').strip()
            if not our_id or not provider_id:
                continue
            cleaned.append((our_id, provider_id))

        has_tenant_column = True
        with transaction.atomic():
            with connection.cursor() as cursor:
                try:
                    cursor.execute('DELETE FROM package_mappings WHERE "tenantId"=%s AND provider_api_id=%s', [tenant_id, integration_id])
                except ProgrammingError:
                    cursor.execute('DELETE FROM package_mappings WHERE provider_api_id=%s', [integration_id])
                    has_tenant_column = False

                for our_id, provider_id in cleaned:
                    if has_tenant_column:
                        try:
                            cursor.execute(
                                'INSERT INTO package_mappings (id, "tenantId", our_package_id, provider_api_id, provider_package_id) '
                                'VALUES (gen_random_uuid(), %s, %s, %s, %s)',
                                [tenant_id, our_id, integration_id, provider_id],
                            )
                            continue
                        except ProgrammingError:
                            has_tenant_column = False
                    cursor.execute(
                        'INSERT INTO package_mappings (id, our_package_id, provider_api_id, provider_package_id) '
                        'VALUES (gen_random_uuid(), %s, %s, %s)',
                        [our_id, integration_id, provider_id],
                    )

        return Response({'count': len(cleaned)})


class AdminIntegrationSyncProductsView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Integrations"],
        description="جلب قائمة باقات المزود وتحديثها محلياً.",
        responses={200: dict},
    )
    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request) or ''
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            obj = Integration.objects.get(id=id)
        except Integration.DoesNotExist:
            raise NotFound('التكامل غير موجود')
        if str(obj.tenant_id) != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا التكامل')

        binding, creds = resolve_adapter_credentials(
            obj.provider,
            base_url=obj.base_url,
            api_token=getattr(obj, 'api_token', None),
            kod=getattr(obj, 'kod', None),
            sifre=getattr(obj, 'sifre', None),
        )
        if not binding:
            return Response({'synced': False, 'message': 'لا يوجد Adapter لهذا المزوّد بعد'}, status=400)

        try:
            items = binding.adapter.list_products(creds) or []
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning('Failed to sync provider products', extra={'integration_id': str(obj.id), 'provider': obj.provider, 'reason': str(exc)[:120]})
            return Response({'synced': False, 'message': str(exc)[:200]}, status=502)

        return Response({'synced': True, 'count': len(items), 'items': items})


class AdminIntegrationTestView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Integrations"],
        description="تشغيل اختبار سريع للتأكد من صلاحية الربط مع المزود وإرجاع الرصيد عند توفره.",
        responses={200: dict},
    )
    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request) or ''
        try:
            obj = Integration.objects.get(id=id)
        except Integration.DoesNotExist:
            raise NotFound('التكامل غير موجود')
        if str(obj.tenant_id) != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا التكامل')
        payload = _build_balance_payload(obj, persist=False)
        return Response(payload)


class AdminIntegrationBalancePreviewView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Integrations"],
        description="Preview provider balance using supplied credentials without persisting any changes.",
        request=dict,
        responses={200: dict},
    )
    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request) or ''
        try:
            obj = Integration.objects.get(id=id)
        except Integration.DoesNotExist:
            raise NotFound('التكامل غير موجود')
        if str(obj.tenant_id) != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا التكامل')

        overrides = {}
        if isinstance(request.data, dict):
            for key in ('provider', 'baseUrl', 'base_url', 'kod', 'sifre', 'apiToken'):
                if key in request.data:
                    overrides[key] = request.data[key]

        payload = _build_balance_payload(obj, persist=False, overrides=overrides or None)
        return Response(payload)


class AdminIntegrationBalanceView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Integrations"],
        description="Refresh provider balance for this integration using the provider adapter. Returns latest balance and timestamp.",
        responses={200: dict},
    )
    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request) or ''
        try:
            obj = Integration.objects.get(id=id)
        except Integration.DoesNotExist:
            raise NotFound('التكامل غير موجود')
        if str(obj.tenant_id) != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا التكامل')
        payload = _build_balance_payload(obj, persist=True)
        return Response(payload)


class AdminIntegrationImportCatalogView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Integrations"],
        description="Import provider catalog and optionally apply mappings and costs. Query: apply, applyCosts, currency, hint, productId",
        responses={202: dict},
    )
    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request) or ''
        try:
            obj = Integration.objects.get(id=id)
        except Integration.DoesNotExist:
            raise NotFound('التكامل غير موجود')
        if str(obj.tenant_id) != tenant_id:
            raise PermissionDenied('لا تملك صلاحية على هذا التكامل')

        binding, creds = resolve_adapter_credentials(
            obj.provider,
            base_url=obj.base_url,
            api_token=getattr(obj, 'api_token', None),
            kod=getattr(obj, 'kod', None),
            sifre=getattr(obj, 'sifre', None),
        )
        if not binding:
            return Response({'accepted': False, 'message': 'لا يوجد Adapter لهذا المزوّد'}, status=400)

        try:
            catalog = binding.adapter.fetch_catalog(creds)
        except Exception as e:
            return Response({'accepted': False, 'message': f'فشل جلب الكتالوج: {str(e)[:200]}'}, status=502)

        # flags
        apply = str(request.query_params.get('apply') or '').lower() in ('1', 'true', 'yes')
        apply_costs = str(request.query_params.get('applyCosts') or '').lower() in ('1', 'true', 'yes')
        costs_currency = (request.query_params.get('currency') or 'USD').strip() or 'USD'
        name_hint = (request.query_params.get('hint') or '').strip().lower()
        only_product_id = (request.query_params.get('productId') or '').strip() or None

        if not apply:
            return Response({'accepted': True, 'count': len(catalog)}, status=202)

        def norm(s: str) -> str:
            s = (s or '').lower().strip()
            for ch in ['\u200f', '\u200e', '\u202a', '\u202b', '\u202c', '\u202d', '\u202e']:
                s = s.replace(ch, '')
            s = s.replace('-', ' ').replace('_', ' ').replace('/', ' ')
            s = ' '.join(s.split())
            return s

        # Prefetch candidate packages once (scoped by product if provided)
        with connection.cursor() as c:
            if only_product_id:
                c.execute('SELECT id, name FROM product_packages WHERE "tenantId"=%s AND product_id=%s ORDER BY name ASC', [tenant_id, only_product_id])
            else:
                c.execute('SELECT id, name FROM product_packages WHERE "tenantId"=%s ORDER BY name ASC', [tenant_id])
            pkgs = c.fetchall()

        matched = inserted = updated = unmatched = 0
        details = []
        for item in catalog:
            ext_id = str(item.get('externalId') or '').strip()
            name = (item.get('name') or '').strip()
            if not ext_id or not name:
                unmatched += 1
                continue
            if name_hint and name_hint not in norm(name):
                continue
            target = norm(name)
            pick_id = None
            pick_name = None
            for rid, rname in pkgs:
                rn = norm(rname)
                if rn == target or target in rn or rn in target:
                    pick_id = rid
                    pick_name = rname
                    break
            if not pick_id:
                unmatched += 1
                details.append({'externalId': ext_id, 'name': name, 'match': None})
                continue
            pkg_id = pick_id
            matched += 1

            # upsert mapping
            with connection.cursor() as c:
                c.execute('SELECT id, provider_package_id FROM package_mappings WHERE "tenantId"=%s AND our_package_id=%s AND provider_api_id=%s', [tenant_id, pkg_id, obj.id])
                mrow = c.fetchone()
                if mrow:
                    if str(mrow[1]) != ext_id:
                        # Avoid timestamp columns to support schemas without them
                        c.execute('UPDATE package_mappings SET provider_package_id=%s WHERE id=%s', [ext_id, mrow[0]])
                        updated += 1
                else:
                    c.execute('INSERT INTO package_mappings (id, "tenantId", our_package_id, provider_api_id, provider_package_id) VALUES (gen_random_uuid(), %s, %s, %s, %s)', [tenant_id, pkg_id, obj.id, ext_id])
                    inserted += 1

            # optional upsert costs
            if apply_costs:
                price = None
                for k in ('price', 'cost', 'maliyet', 'fiyat', 'bayi_maliyeti'):
                    v = item.get(k)
                    if isinstance(v, (int, float)):
                        price = float(v)
                        break
                    if isinstance(v, str):
                        try:
                            price = float(v.replace(',', '.').strip())
                            break
                        except Exception:
                            pass
                if price is not None:
                    with connection.cursor() as c:
                        c.execute('SELECT id FROM package_costs WHERE "tenantId"=%s AND package_id=%s AND "providerId"=%s', [tenant_id, pkg_id, obj.id])
                        crow = c.fetchone()
                        if crow:
                            c.execute('UPDATE package_costs SET "costCurrency"=%s, "costAmount"=%s WHERE id=%s', [costs_currency, price, crow[0]])
                        else:
                            c.execute('INSERT INTO package_costs (id, "tenantId", package_id, "providerId", "costCurrency", "costAmount") VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)', [tenant_id, pkg_id, obj.id, costs_currency, price])

            details.append({'externalId': ext_id, 'name': name, 'match': str(pkg_id), 'matchedName': pick_name})

        return Response({'accepted': True, 'count': len(catalog), 'matched': matched, 'inserted': inserted, 'updated': updated, 'unmatched': unmatched, 'details': details[:100]}, status=202)


class AdminProvidersCoverageView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    # If kupur is present and numeric, we may store it in mapping notes later; keep cost separate
    @extend_schema(
        tags=["Admin Providers"],
        parameters=[
            OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER),
            OpenApiParameter(name='providerId', required=False, type=str),
            OpenApiParameter(name='productId', required=False, type=str),
        ],
        responses={200: CoverageResponseSerializer}
    )
    def get(self, request):
        tenant_id = _resolve_tenant_id(request) or ''
        provider_id_filter = (request.query_params.get('providerId') or '').strip() or None
        product_id_filter = (request.query_params.get('productId') or '').strip() or None
        # Build a coverage list by joining product_packages with routing, mappings, and costs
        sql = '''
            SELECT
                pp.id as package_id,
                pp.name as package_name,
                pp.product_id as product_id,
                p.name as product_name,
                pr.mode as routing_mode,
                pr."providerType" as provider_type,
                pr."primaryProviderId" as primary_provider_id,
                i.name as provider_name,
                pm.provider_package_id as mapped_provider_package_id,
                (pm.id IS NOT NULL) as mapping_exists,
                pm."updatedAt" as mapping_updated_at,
                pc."costCurrency" as cost_currency,
                pc."costAmount" as cost_amount,
                (pc.id IS NOT NULL) as cost_exists
            FROM product_packages pp
            LEFT JOIN product p ON p.id = pp.product_id
            LEFT JOIN package_routing pr ON pr.package_id = pp.id AND pr."tenantId" = %s
            LEFT JOIN integrations i ON i.id = pr."primaryProviderId" AND i."tenantId" = %s
            LEFT JOIN package_mappings pm ON pm.our_package_id = pp.id AND pm."tenantId" = %s AND pm.provider_api_id::text = pr."primaryProviderId"
            LEFT JOIN package_costs pc ON pc.package_id = pp.id AND pc."tenantId" = %s AND pc."providerId" = pr."primaryProviderId"
            WHERE pp."tenantId" = %s AND pp."isActive" = true
                AND (%s IS NULL OR pr."primaryProviderId" = %s)
                AND (%s IS NULL OR pp.product_id = %s)
            ORDER BY p.name NULLS LAST, pp.name NULLS LAST
        '''
        with connection.cursor() as c:
            c.execute(sql, [tenant_id, tenant_id, tenant_id, tenant_id, tenant_id, provider_id_filter, provider_id_filter, product_id_filter, product_id_filter])
            rows = c.fetchall()
            cols = [col[0] for col in c.description]
        items = []
        for r in rows:
            rec = dict(zip(cols, r))
            items.append({
                'packageId': rec.get('package_id'),
                'packageName': rec.get('package_name'),
                'productId': rec.get('product_id'),
                'productName': rec.get('product_name'),
                'routingMode': rec.get('routing_mode'),
                'providerType': rec.get('provider_type'),
                'providerId': rec.get('primary_provider_id'),
                'providerName': rec.get('provider_name'),
                'mappingExists': bool(rec.get('mapping_exists')),
                'mappedProviderPackageId': rec.get('mapped_provider_package_id'),
                'mappingUpdatedAt': rec.get('mapping_updated_at').isoformat() if rec.get('mapping_updated_at') else None,
                'costExists': bool(rec.get('cost_exists')),
                'costCurrency': rec.get('cost_currency'),
                'costAmount': rec.get('cost_amount'),
            })
        return Response({'items': items})


class AdminProvidersCoverageCSVView(AdminProvidersCoverageView):
    @extend_schema(exclude=True)
    def get(self, request):
        resp = super().get(request)
        items = resp.data.get('items', [])
        headers = ['packageId','packageName','productId','productName','priceGroupId','priceGroupName','routingMode','providerType','providerId','providerName','mappingExists','mappedProviderPackageId','mappingUpdatedAt','costExists','costCurrency','costAmount']
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=coverage.csv'
        writer = csv.DictWriter(response, fieldnames=headers)
        writer.writeheader()
        for row in items:
            writer.writerow({k: row.get(k) for k in headers})
        return response
