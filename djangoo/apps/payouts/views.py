from __future__ import annotations

from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import Payout
from .serializers import (
    PayoutListItemSerializer,
    AdminPayoutListItemSerializer,
    PayoutDetailsSerializer,
    PayoutsListResponseSerializer,
    AdminPayoutsListResponseSerializer,
    AdminPayoutActionRequestSerializer,
    AdminPayoutActionResponseSerializer,
    AdminPayoutNotesResponseSerializer,
)


def _resolve_tenant_id(request) -> str | None:
    tid = getattr(request, 'tenant', None)
    if tid and getattr(tid, 'id', None):
        return str(tid.id)
    user = getattr(request, 'user', None)
    if user and getattr(user, 'tenant_id', None):
        return str(user.tenant_id)
    return None


class MyPayoutsListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Payouts"],
        parameters=[OpenApiParameter(name='limit', required=False, type=int), OpenApiParameter(name='cursor', required=False, type=str)],
        responses={200: PayoutsListResponseSerializer}
    )
    def get(self, request):
        user = request.user
        limit = int(request.query_params.get('limit') or 20)
        limit = max(1, min(limit, 100))
        cursor = request.query_params.get('cursor') or None
        qs = Payout.objects.filter(user_id=getattr(user, 'id', None)).order_by('-created_at')
        if cursor:
            try:
                qs = qs.filter(created_at__lt=cursor)
            except Exception:
                pass
        items = list(qs[: limit + 1])
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None
        return Response({ 'items': PayoutListItemSerializer(items, many=True).data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more } })


class AdminPayoutsListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Admin Payouts"],
        parameters=[
            OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER),
            OpenApiParameter(name='limit', required=False, type=int),
            OpenApiParameter(name='cursor', required=False, type=str),
            OpenApiParameter(name='status', required=False, type=str),
            OpenApiParameter(name='q', required=False, type=str),
        ],
        responses={200: AdminPayoutsListResponseSerializer}
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
        qs = Payout.objects.filter(tenant_id=tenant_id).order_by('-created_at')
        if status_filter in ('pending','approved','rejected','sent'):
            qs = qs.filter(status=status_filter)
        if q:
            qs = qs.filter(Q(external_ref__icontains=q))
        if cursor:
            try:
                qs = qs.filter(created_at__lt=cursor)
            except Exception:
                pass
        items = list(qs[: limit + 1])
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None
        data = AdminPayoutListItemSerializer(items, many=True).data
        return Response({ 'items': data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more } })


class AdminPayoutDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Admin Payouts"], responses={200: PayoutDetailsSerializer})
    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            p = Payout.objects.get(id=id)
        except Payout.DoesNotExist:
            raise NotFound('الدفعة غير موجودة')
        if str(p.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذه الدفعة')
        return Response(PayoutDetailsSerializer(p).data)

    @extend_schema(tags=["Admin Payouts"], request=AdminPayoutActionRequestSerializer, responses={200: AdminPayoutActionResponseSerializer})
    def patch(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            p = Payout.objects.get(id=id)
        except Payout.DoesNotExist:
            raise NotFound('الدفعة غير موجودة')
        if str(p.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذه الدفعة')

        action = str(request.data.get('status') or '').strip()
        note = str(request.data.get('note') or '').strip()
        if action not in ('approved','rejected','sent'):
            raise ValidationError('الحالة غير صحيحة')
        p.status = action
        if action == 'sent':
            import datetime
            if p.sent_at is None:
                p.sent_at = datetime.datetime.utcnow()
        if note:
            p.manual_note = (note or '')[:500]
            import datetime
            n = { 'by': 'admin', 'text': f"Manual {action}: {note}", 'at': datetime.datetime.utcnow().isoformat() }
            notes = list(p.notes or [])
            notes.append(n)
            p.notes = notes
            try:
                if p.notes_count is not None:
                    p.notes_count = int(p.notes_count) + 1
            except Exception:
                pass
        p.save()
        return Response({ 'ok': True, 'id': str(p.id), 'status': p.status })


class AdminPayoutNotesView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Admin Payouts"], responses={200: AdminPayoutNotesResponseSerializer})
    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            p = Payout.objects.get(id=id)
        except Payout.DoesNotExist:
            raise NotFound('الدفعة غير موجودة')
        if str(p.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذه الدفعة')
        return Response({ 'payoutId': str(p.id), 'notes': p.notes or [] })

    @extend_schema(tags=["Admin Payouts"], request=None, responses={200: AdminPayoutNotesResponseSerializer})
    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        text = str(request.data.get('text') or '').strip()
        by = (request.data.get('by') or 'admin').strip()
        if not text:
            raise ValidationError('النص مطلوب')
        try:
            p = Payout.objects.get(id=id)
        except Payout.DoesNotExist:
            raise NotFound('الدفعة غير موجودة')
        if str(p.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذه الدفعة')
        import datetime
        note = { 'by': by if by in ('admin','system','user') else 'admin', 'text': text, 'at': datetime.datetime.utcnow().isoformat() }
        notes = list(p.notes or [])
        notes.append(note)
        p.notes = notes
        try:
            if p.notes_count is not None:
                p.notes_count = int(p.notes_count) + 1
            p.save(update_fields=['notes','notes_count'])
        except Exception:
            p.save()
        return Response({ 'payoutId': str(p.id), 'notes': p.notes or [] })
