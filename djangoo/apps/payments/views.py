from __future__ import annotations

from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import RequireAdminRole
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import PaymentMethod, Deposit
from .serializers import (
    PaymentMethodSerializer,
    AdminPaymentMethodSerializer,
    AdminPaymentMethodUpsertSerializer,
    DepositListItemSerializer,
    AdminDepositListItemSerializer,
    DepositDetailsSerializer,
    DepositsListResponseSerializer,
    AdminDepositsListResponseSerializer,
    AdminDepositActionRequestSerializer,
    AdminDepositActionResponseSerializer,
    AdminDepositNotesResponseSerializer,
)
from rest_framework.parsers import MultiPartParser, FormParser


def _resolve_tenant_id(request) -> str | None:
    # Prefer explicit header, then domain mapping, then request.tenant, then user fallback
    try:
        from django.conf import settings
        from apps.tenants.models import TenantDomain  # type: ignore
    except Exception:
        settings = None
        TenantDomain = None
    direct_tid = request.META.get('HTTP_X_TENANT_ID')
    if direct_tid:
        return str(direct_tid)
    if settings is not None:
        host_header = request.META.get(getattr(settings, 'TENANT_HEADER', 'HTTP_X_TENANT_HOST')) or request.META.get('HTTP_HOST')
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


class PaymentMethodsListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Payments"], responses={200: PaymentMethodSerializer(many=True)})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        qs = PaymentMethod.objects.filter(tenant_id=tenant_id, is_active=True).order_by('name')
        return Response(PaymentMethodSerializer(qs, many=True).data)


class AdminPaymentMethodsListCreateView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Payments"], responses={200: AdminPaymentMethodSerializer(many=True)})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        qs = PaymentMethod.objects.filter(tenant_id=tenant_id).order_by('name')
        data = [AdminPaymentMethodSerializer.from_model(x) for x in qs]
        return Response(data)

    @extend_schema(tags=["Admin Payments"], request=AdminPaymentMethodUpsertSerializer, responses={201: AdminPaymentMethodSerializer})
    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        s = AdminPaymentMethodUpsertSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        v = s.validated_data
        import uuid, datetime
        pm = PaymentMethod(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name=v['name'],
            is_active=bool(v.get('isActive', True)),
            type=v['type'],
            config=v.get('config') or {},
            logo_url=v.get('logoUrl') or None,
            note=v.get('note') or None,
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        )
        try:
            pm.save(force_insert=True)
        except Exception:
            # Unmanaged: fallback to raw insert
            from django.db import connection
            with connection.cursor() as c:
                c.execute(
                    'INSERT INTO payment_method (id, "tenantId", name, type, "isActive", config, "logoUrl", note, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
                    [str(pm.id), str(tenant_id), pm.name, pm.type, pm.is_active, pm.config, pm.logo_url, pm.note]
                )
        return Response(AdminPaymentMethodSerializer.from_model(pm), status=201)


class AdminPaymentMethodByIdView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def get_obj(self, tenant_id: str, id: str) -> PaymentMethod:
        try:
            pm = PaymentMethod.objects.get(id=id)
        except PaymentMethod.DoesNotExist:
            raise NotFound('طريقة الدفع غير موجودة')
        if str(pm.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذه الطريقة')
        return pm

    @extend_schema(tags=["Admin Payments"], responses={200: AdminPaymentMethodSerializer})
    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        pm = self.get_obj(tenant_id, id)
        return Response(AdminPaymentMethodSerializer.from_model(pm))

    @extend_schema(tags=["Admin Payments"], request=AdminPaymentMethodUpsertSerializer, responses={200: AdminPaymentMethodSerializer})
    def patch(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        pm = self.get_obj(tenant_id, id)
        s = AdminPaymentMethodUpsertSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        v = s.validated_data
        pm.name = v['name']
        if 'isActive' in v:
            pm.is_active = bool(v['isActive'])
        pm.type = v['type']
        if v.get('logoUrl') is not None:
            pm.logo_url = v.get('logoUrl') or None
        if v.get('note') is not None:
            pm.note = v.get('note') or None
        if v.get('config') is not None:
            pm.config = v.get('config') or {}
        try:
            pm.save(update_fields=['name','is_active','type','config','logo_url','note','updated_at'])
        except Exception:
            pm.save()
        return Response(AdminPaymentMethodSerializer.from_model(pm))

    @extend_schema(tags=["Admin Payments"], responses={200: None})
    def delete(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        pm = self.get_obj(tenant_id, id)
        try:
            pm.delete()
        except Exception:
            # unmanaged fallback
            from django.db import connection
            with connection.cursor() as c:
                c.execute('DELETE FROM payment_method WHERE id=%s AND "tenantId"=%s', [str(pm.id), str(tenant_id)])
        return Response({ 'ok': True })


class AdminUploadView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(tags=["Admin"], request=None, responses={200: None})
    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            raise ValidationError('file required')
        # In dev, return a placeholder data URL; in prod, you would upload to S3 or save to storage
        try:
            content = file.read()
            import base64
            b64 = base64.b64encode(content).decode('ascii')
            mime = file.content_type or 'application/octet-stream'
            return Response({ 'url': f'data:{mime};base64,{b64}' })
        except Exception:
            return Response({ 'url': None })


class AdminPendingDepositsCountView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Payments"], responses={200: None})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        count = Deposit.objects.filter(tenant_id=tenant_id, status='pending').count()
        return Response({ 'count': int(count) })


class MyDepositsListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Payments"],
        parameters=[
            OpenApiParameter(name='limit', required=False, type=int),
            OpenApiParameter(name='cursor', required=False, type=str),
        ],
        responses={200: DepositsListResponseSerializer}
    )
    def get(self, request):
        user = request.user
        limit = int(request.query_params.get('limit') or 20)
        limit = max(1, min(limit, 100))
        cursor = request.query_params.get('cursor') or None
        qs = Deposit.objects.filter(user_id=getattr(user, 'id', None)).order_by('-created_at')
        if cursor:
            try:
                qs = qs.filter(created_at__lt=cursor)
            except Exception:
                pass
        items = list(qs[: limit + 1])
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None
        return Response({ 'items': DepositListItemSerializer(items, many=True).data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more } })


class AdminDepositsListView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Payments"],
        parameters=[
            OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER),
            OpenApiParameter(name='limit', required=False, type=int),
            OpenApiParameter(name='cursor', required=False, type=str),
            OpenApiParameter(name='status', required=False, type=str),
            OpenApiParameter(name='q', required=False, type=str),
        ],
        responses={200: AdminDepositsListResponseSerializer}
    )
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')

        limit = int(request.query_params.get('limit') or 20)
        limit = max(1, min(limit, 100))
        cursor = request.query_params.get('cursor') or None
        status_filter = (request.query_params.get('status') or '').strip()
        q = (request.query_params.get('q') or '').strip()

        qs = Deposit.objects.filter(tenant_id=tenant_id).order_by('-created_at')
        if status_filter in ('pending','approved','rejected'):
            qs = qs.filter(status=status_filter)
        if q:
            qs = qs.filter(Q(note__icontains=q))
        if cursor:
            try:
                qs = qs.filter(created_at__lt=cursor)
            except Exception:
                pass

        items = list(qs[: limit + 1])
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None

        data = AdminDepositListItemSerializer(items, many=True).data
        return Response({ 'items': data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more } })


class AdminDepositDetailsView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Payments"], responses={200: DepositDetailsSerializer})
    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            d = Deposit.objects.get(id=id)
        except Deposit.DoesNotExist:
            raise NotFound('الإيداع غير موجود')
        if str(d.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذا الإيداع')
        return Response(DepositDetailsSerializer(d).data)

    @extend_schema(tags=["Admin Payments"], request=AdminDepositActionRequestSerializer, responses={200: AdminDepositActionResponseSerializer})
    def patch(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            d = Deposit.objects.get(id=id)
        except Deposit.DoesNotExist:
            raise NotFound('الإيداع غير موجود')
        if str(d.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذا الإيداع')

        action = str(request.data.get('status') or '').strip()
        note = str(request.data.get('note') or '').strip()
        if action not in ('approved','rejected'):
            raise ValidationError('الحالة غير صحيحة')

        d.status = action
        if note:
            # append note text to existing note field if present
            d.note = (note if not d.note else (str(d.note) + '\n' + note))[:1000]
        d.save()
        return Response({ 'ok': True, 'id': str(d.id), 'status': d.status })


class AdminDepositNotesView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Payments"], responses={200: AdminDepositNotesResponseSerializer})
    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            d = Deposit.objects.get(id=id)
        except Deposit.DoesNotExist:
            raise NotFound('الإيداع غير موجود')
        if str(d.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذا الإيداع')
        # No structured notes in DB; return single string note if exists
        notes = []
        if d.note:
            notes = [{ 'by': 'system', 'text': d.note, 'at': d.created_at.isoformat() }]
        return Response({ 'depositId': str(d.id), 'notes': notes })

    @extend_schema(tags=["Admin Payments"], request=None, responses={200: AdminDepositNotesResponseSerializer})
    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        text = str(request.data.get('text') or '').strip()
        by = (request.data.get('by') or 'admin').strip()
        if not text:
            raise ValidationError('النص مطلوب')
        try:
            d = Deposit.objects.get(id=id)
        except Deposit.DoesNotExist:
            raise NotFound('الإيداع غير موجود')
        if str(d.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذا الإيداع')
        import datetime
        note_entry = f"[{datetime.datetime.utcnow().isoformat()}] {by}: {text}"
        d.note = (note_entry if not d.note else (str(d.note) + '\n' + note_entry))[:2000]
        d.save()
        notes = [{ 'by': by if by in ('admin','system','user') else 'admin', 'text': text, 'at': datetime.datetime.utcnow().isoformat() }]
        return Response({ 'depositId': str(d.id), 'notes': notes })

class AdminDepositStatusView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Payments"], request=AdminDepositActionRequestSerializer, responses={200: AdminDepositActionResponseSerializer})
    def patch(self, request, id: str):
        # Proxy to AdminDepositDetailsView.patch for DRY
        view = AdminDepositDetailsView()
        return view.patch(request, id)
