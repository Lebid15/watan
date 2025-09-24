from __future__ import annotations

from django.db.models import Q
from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import RequireAdminRole
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiParameter
import csv
from django.http import HttpResponse

from .models import ProviderAPI, PackageMapping, Integration, PackageRouting, PackageCost
from django.conf import settings
try:
    from apps.tenants.models import TenantDomain  # type: ignore
except Exception:
    TenantDomain = None
from .adapters import get_adapter, ZnetCredentials
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
        if 'provider_api' in existing_tables:
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
        if 'package_costs' in existing_tables:
            try:
                for pc in PackageCost.objects.filter(tenant_id=tenant_id, package_id__in=pkg_ids):
                    costs.setdefault(str(pc.package_id), []).append(pc)
            except Exception:
                costs = {}

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
            for c in costs.get(pkg_id, []) or []:
                p = providers_map.get(str(c.provider_id))
                prov_costs.append({
                    'providerId': str(c.provider_id),
                    'providerName': getattr(p, 'name', str(c.provider_id)),
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
            'providers': [{ 'id': str(p.id), 'name': p.name, 'type': 'external' } for p in providers],
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
        mapped = PackageMapping.objects.filter(tenant_id=tenant_id, our_package_id=package_id, provider_api_id=provider_id).exists()
        cost = PackageCost.objects.filter(tenant_id=tenant_id, package_id=package_id, provider_id=provider_id).first()
        resp = { 'mapped': bool(mapped) }
        if cost:
            resp['cost'] = { 'amount': float(cost.cost_amount or 0), 'currency': cost.cost_currency }
        else:
            resp['message'] = 'لا توجد تكلفة محددة للمزوّد'
        return Response(resp)


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
        adapter = get_adapter(obj.provider)
        if not adapter:
            # Keep behavior if no adapter yet
            with connection.cursor() as c:
                c.execute('UPDATE integrations SET balance=COALESCE(balance,0)+0, "balanceUpdatedAt"=NOW() WHERE id=%s', [id])
            obj.refresh_from_db()
            return Response({ 'balance': float(obj.balance) if obj.balance is not None else None, 'balanceUpdatedAt': obj.balance_updated_at.isoformat() if obj.balance_updated_at else None })
        creds = ZnetCredentials(base_url=obj.base_url, kod=obj.kod, sifre=obj.sifre)
        try:
            res = adapter.get_balance(creds)
            bal = res.get('balance')
            with connection.cursor() as c:
                c.execute('UPDATE integrations SET balance=%s, "balanceUpdatedAt"=NOW() WHERE id=%s', [bal, id])
            obj.refresh_from_db()
            return Response({ 'balance': float(obj.balance) if obj.balance is not None else None, 'balanceUpdatedAt': obj.balance_updated_at.isoformat() if obj.balance_updated_at else None })
        except Exception as e:
            # If balance unsupported, surface graceful message
            msg = str(e)
            if 'BALANCE_UNSUPPORTED' in msg:
                return Response({ 'balance': float(obj.balance) if obj.balance is not None else None, 'balanceUpdatedAt': obj.balance_updated_at.isoformat() if obj.balance_updated_at else None, 'note': 'Balance endpoint not configured for this provider. It will update after successful orders.' })
            raise


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

        adapter = get_adapter(obj.provider)
        if not adapter:
            return Response({'accepted': False, 'message': 'لا يوجد Adapter لهذا المزوّد'}, status=400)

        creds = ZnetCredentials(base_url=obj.base_url, kod=obj.kod, sifre=obj.sifre)
        try:
            catalog = adapter.fetch_catalog(creds)
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
