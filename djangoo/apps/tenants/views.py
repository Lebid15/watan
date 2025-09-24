from __future__ import annotations

from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, ValidationError, PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import Tenant, TenantDomain
from .serializers import (
    TenantSerializer, TenantCreateRequest, TenantUpdateRequest,
    TenantDomainSerializer, DomainCreateRequest, DomainUpdateRequest,
)


def _require_instance_owner(user):
    # Simple check; replace with proper roles when available
    role = getattr(user, 'role', None)
    if role not in ('instance_owner', 'developer', 'admin'):
        raise PermissionDenied('INSUFFICIENT_ROLE')


class AdminTenantsListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Admin Tenants"], responses={200: TenantSerializer(many=True)})
    def get(self, request):
        _require_instance_owner(request.user)
        qs = Tenant.objects.all().order_by('created_at')
        return Response(TenantSerializer(qs, many=True).data)

    @extend_schema(tags=["Admin Tenants"], request=TenantCreateRequest, responses={201: TenantSerializer})
    def post(self, request):
        _require_instance_owner(request.user)
        data = TenantCreateRequest(data=request.data)
        data.is_valid(raise_exception=True)
        payload = data.validated_data
        # Insert via raw SQL to unmanaged table
        with connection.cursor() as c:
            c.execute(
                """
                INSERT INTO tenant (id, name, code, "ownerUserId", "isActive")
                VALUES (gen_random_uuid(), %s, %s, %s, %s)
                RETURNING id
                """,
                [payload.get('name'), payload.get('code'), payload.get('owner_user_id'), payload.get('is_active', True)]
            )
            new_id = c.fetchone()[0]
        obj = Tenant.objects.get(id=new_id)
        return Response(TenantSerializer(obj).data, status=201)


class AdminTenantDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Admin Tenants"], responses={200: TenantSerializer})
    def get(self, request, tenant_id: str):
        _require_instance_owner(request.user)
        try:
            obj = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            raise NotFound()
        return Response(TenantSerializer(obj).data)

    @extend_schema(tags=["Admin Tenants"], request=TenantUpdateRequest, responses={200: TenantSerializer})
    def patch(self, request, tenant_id: str):
        _require_instance_owner(request.user)
        try:
            obj = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            raise NotFound()
        data = TenantUpdateRequest(data=request.data)
        data.is_valid(raise_exception=True)
        payload = data.validated_data
        sets = []
        params = []
        mapping = {
            'name': 'name',
            'code': 'code',
            'owner_user_id': '"ownerUserId"',
            'is_active': '"isActive"',
        }
        for k,v in payload.items():
            sets.append(f"{mapping[k]}=%s")
            params.append(v)
        if not sets:
            return Response(TenantSerializer(obj).data)
        params.append(tenant_id)
        with connection.cursor() as c:
            c.execute(f"UPDATE tenant SET {', '.join(sets)}, \"updatedAt\"=NOW() WHERE id=%s", params)
        obj.refresh_from_db()
        return Response(TenantSerializer(obj).data)

    @extend_schema(tags=["Admin Tenants"], responses={204: None})
    def delete(self, request, tenant_id: str):
        _require_instance_owner(request.user)
        with connection.cursor() as c:
            c.execute("UPDATE tenant SET deleted_at=NOW(), \"isActive\"=FALSE WHERE id=%s", [tenant_id])
        return Response(status=204)


class AdminTenantDomainsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Admin Tenants"], responses={200: TenantDomainSerializer(many=True)})
    def get(self, request, tenant_id: str):
        _require_instance_owner(request.user)
        qs = TenantDomain.objects.filter(tenant_id=tenant_id).order_by('-is_primary','created_at')
        return Response(TenantDomainSerializer(qs, many=True).data)

    @extend_schema(tags=["Admin Tenants"], request=DomainCreateRequest, responses={201: TenantDomainSerializer})
    def post(self, request, tenant_id: str):
        _require_instance_owner(request.user)
        d = DomainCreateRequest(data=request.data)
        d.is_valid(raise_exception=True)
        payload = d.validated_data
        with connection.cursor() as c:
            c.execute(
                """
                INSERT INTO tenant_domain (id, "tenantId", domain, type, "isPrimary", "isVerified")
                VALUES (gen_random_uuid(), %s, %s, COALESCE(%s,'subdomain'), COALESCE(%s,false), false)
                RETURNING id
                """,
                [tenant_id, payload['domain'], payload.get('type'), payload.get('is_primary', False)]
            )
            new_id = c.fetchone()[0]
        obj = TenantDomain.objects.get(id=new_id)
        return Response(TenantDomainSerializer(obj).data, status=201)


class AdminTenantDomainDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Admin Tenants"], responses={200: TenantDomainSerializer})
    def patch(self, request, tenant_id: str, domain_id: str):
        _require_instance_owner(request.user)
        try:
            obj = TenantDomain.objects.get(id=domain_id, tenant_id=tenant_id)
        except TenantDomain.DoesNotExist:
            raise NotFound()
        d = DomainUpdateRequest(data=request.data)
        d.is_valid(raise_exception=True)
        payload = d.validated_data
        sets, params = [], []
        mapping = {
            'domain': 'domain',
            'type': 'type',
            'is_primary': '"isPrimary"',
            'is_verified': '"isVerified"',
        }
        for k,v in payload.items():
            sets.append(f"{mapping[k]}=%s")
            params.append(v)
        if not sets:
            return Response(TenantDomainSerializer(obj).data)
        params.extend([tenant_id, domain_id])
        with connection.cursor() as c:
            c.execute(f"UPDATE tenant_domain SET {', '.join(sets)}, \"updatedAt\"=NOW() WHERE \"tenantId\"=%s AND id=%s", params)
        obj.refresh_from_db()
        return Response(TenantDomainSerializer(obj).data)

    @extend_schema(tags=["Admin Tenants"], responses={204: None})
    def delete(self, request, tenant_id: str, domain_id: str):
        _require_instance_owner(request.user)
        with connection.cursor() as c:
            c.execute("DELETE FROM tenant_domain WHERE \"tenantId\"=%s AND id=%s", [tenant_id, domain_id])
        return Response(status=204)


class CurrentTenantView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Tenants"], parameters=[
        OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER),
    ])
    def get(self, request):
        tid = getattr(request, 'tenant', None)
        if tid and getattr(tid, 'id', None):
            return Response({ 'tenantId': str(tid.id) })
        uid = getattr(request.user, 'tenant_id', None)
        if uid:
            return Response({ 'tenantId': str(uid) })
        raise ValidationError('TENANT_NOT_RESOLVED')
