from __future__ import annotations

import uuid
from typing import List
from django.db import transaction
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, NotFound

from apps.users.permissions import RequireAdminRole
from .models import CodeGroup, CodeItem
from .serializers import CodeGroupSerializer, CodeItemSerializer


def _resolve_tenant_id(request) -> str | None:
    tid = getattr(request, 'tenant', None)
    if tid and getattr(tid, 'id', None):
        return str(tid.id)
    user = getattr(request, 'user', None)
    if user and getattr(user, 'tenant_id', None):
        return str(user.tenant_id)
    return None


class AdminCodeGroupsListCreateView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            return Response([])
        groups = CodeGroup.objects.filter(tenant_id=tenant_id).order_by('-created_at')
        return Response(CodeGroupSerializer(groups, many=True).data)

    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        name = (request.data.get('name') or '').strip()
        public_code = (request.data.get('publicCode') or '').strip().upper()
        note = (request.data.get('note') or '').strip() or None
        if not name or not public_code:
            raise ValidationError('الاسم و الكود العام مطلوبان')
        # Unique per tenant: (tenantId, publicCode)
        exists = CodeGroup.objects.filter(tenant_id=tenant_id, public_code=public_code).exists()
        if exists:
            raise ValidationError('الكود العام موجود بالفعل')
        grp = CodeGroup(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name=name,
            public_code=public_code,
            note=note,
            provider_type='internal_codes',
            is_active=True,
        )
        # managed=False -> use force_insert to avoid updates
        grp.save(force_insert=True)
        return Response(CodeGroupSerializer(grp).data, status=201)


class AdminCodeGroupToggleView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def patch(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        try:
            grp = CodeGroup.objects.get(id=id, tenant_id=tenant_id)
        except CodeGroup.DoesNotExist:
            raise NotFound('المجموعة غير موجودة')
        grp.is_active = not bool(grp.is_active)
        grp.save(update_fields=['is_active'])
        return Response({'ok': True, 'is_active': grp.is_active})


class AdminCodeGroupItemsListView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            return Response([])
        try:
            CodeGroup.objects.get(id=id, tenant_id=tenant_id)
        except CodeGroup.DoesNotExist:
            raise NotFound('المجموعة غير موجودة')
        items = CodeItem.objects.filter(tenant_id=tenant_id, group_id=id).order_by('-created_at')[:2000]
        return Response(CodeItemSerializer(items, many=True).data)


class AdminCodeGroupItemsBulkAddView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        try:
            CodeGroup.objects.get(id=id, tenant_id=tenant_id)
        except CodeGroup.DoesNotExist:
            raise NotFound('المجموعة غير موجودة')
        codes_raw = request.data.get('codes') or ''
        cost = request.data.get('cost')
        try:
            cost_val = float(cost) if cost not in (None, '') else None
        except Exception:
            raise ValidationError('قيمة التكلفة غير صالحة')
        lines: List[str] = [l.strip() for l in str(codes_raw).splitlines() if l.strip()]
        if not lines:
            raise ValidationError('الرجاء لصق الأكواد')
        items: List[CodeItem] = []
        for line in lines:
            pin = None
            serial = None
            # support formats: PIN;SERIAL or single token as PIN
            if ';' in line:
                pin, serial = [p.strip() or None for p in line.split(';', 1)]
            else:
                pin = line
            ci = CodeItem(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                group_id=id,
                pin=pin,
                serial=serial,
                cost=cost_val or 0,
                status='available',
            )
            items.append(ci)
        with transaction.atomic():
            for it in items:
                it.save(force_insert=True)
        return Response({'ok': True, 'inserted': len(items)})


class AdminCodeItemDeleteView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def delete(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        try:
            # Make sure item belongs to tenant
            obj = CodeItem.objects.get(id=id, tenant_id=tenant_id)
        except CodeItem.DoesNotExist:
            raise NotFound('العنصر غير موجود')
        obj.delete()
        return Response({'ok': True})
