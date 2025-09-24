from __future__ import annotations

from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import RequireAdminRole
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from .models import ProductOrder
from apps.providers.models import PackageRouting, PackageMapping, Integration
from apps.providers.adapters import get_adapter
from django.utils import timezone
from django.db import connection
from datetime import datetime
from .serializers import (
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
try:
    from apps.tenants.models import TenantDomain  # type: ignore
except Exception:
    TenantDomain = None


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
        user = request.user
        limit = int(request.query_params.get('limit') or 20)
        limit = max(1, min(limit, 100))
        cursor = request.query_params.get('cursor') or None

        qs = ProductOrder.objects.filter(user_id=getattr(user, 'id', None)).order_by('-created_at')

        # simple cursor by created_at ISO string
        if cursor:
            try:
                # Expect ISO datetime; retrieve items older than cursor
                qs = qs.filter(created_at__lt=cursor)
            except Exception:
                pass

        items = list(qs.select_related('product', 'package')[: limit + 1])
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None

        data = OrderListItemSerializer(items, many=True).data
        return Response({ 'items': data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more } })


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
            qs = qs.filter(Q(user_identifier__icontains=q) | Q(extra_field__icontains=q))
        if cursor:
            try:
                qs = qs.filter(created_at__lt=cursor)
            except Exception:
                pass

        items = list(qs.select_related('product', 'package')[: limit + 1])
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None

        data = AdminOrderListItemSerializer(items, many=True).data
        return Response({ 'items': data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more } })


class MyOrderDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Orders"], responses={200: MyOrderDetailsResponseSerializer})
    def get(self, request, id: str):
        user = request.user
        try:
            o = ProductOrder.objects.select_related('product', 'package', 'user').get(id=id)
        except ProductOrder.DoesNotExist:
            raise NotFound('الطلب غير موجود')
        # restrict to own order
        if str(getattr(o, 'user_id', '')) != str(getattr(user, 'id', '')):
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
        return Response({ 'order': { **base, **details } })

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

        try:
            o = ProductOrder.objects.select_related('user').get(id=id)
        except ProductOrder.DoesNotExist:
            raise NotFound('الطلب غير موجود')
        self._assert_tenant(request, o)

        # Soft update
        o.status = action
        if note:
            o.manual_note = (note or '')[:500]
            # surface to requester similar to Nest behavior
            o.provider_message = (note or '')[:250]
            o.last_message = f"Manual {action}: {note[:200]}"
            # append a note entry
            import datetime
            n = { 'by': 'admin', 'text': f"Manual {action}: {note}", 'at': datetime.datetime.utcnow().isoformat() }
            notes = list(o.notes or [])
            notes.append(n)
            o.notes = notes
            if o.notes_count is not None:
                try:
                    o.notes_count = int(o.notes_count) + 1
                except Exception:
                    pass
        o.save()

        return Response({ 'ok': True, 'id': str(o.id), 'status': o.status })


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
            adapter = get_adapter(integ.provider)
            if adapter:
                from apps.providers.adapters import ZnetCredentials
                creds = ZnetCredentials(base_url=integ.base_url, kod=integ.kod, sifre=integ.sifre)
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
        adapter = get_adapter(integ.provider)
        if not adapter:
            raise ValidationError('لا يوجد Adapter لهذا المزوّد')
        from apps.providers.adapters import ZnetCredentials
        creds = ZnetCredentials(base_url=integ.base_url, kod=integ.kod, sifre=integ.sifre)
        try:
            res = adapter.fetch_status(creds, str(o.external_order_id))
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
        for oid in ids:
            try:
                o = ProductOrder.objects.get(id=oid, tenant_id=tid)
            except ProductOrder.DoesNotExist:
                continue
            o.status = 'approved'
            if note:
                o.manual_note = (note or '')[:500]
            try:
                o.save(update_fields=['status','manual_note'])
            except Exception:
                o.save()
            updated += 1
        return Response({ 'ok': True, 'count': updated })


class AdminOrdersBulkRejectView(_AdminOrdersBulkBaseView):
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
            o.status = 'rejected'
            if note:
                o.manual_note = (note or '')[:500]
            try:
                o.save(update_fields=['status','manual_note'])
            except Exception:
                o.save()
            updated += 1
        return Response({ 'ok': True, 'count': updated })


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
        results = []
        for oid in ids:
            try:
                o = ProductOrder.objects.get(id=oid, tenant_id=tid)
            except ProductOrder.DoesNotExist:
                results.append({ 'id': oid, 'success': False, 'message': 'not found' })
                continue
            # Only pending and not already dispatched
            if o.status != 'pending' or o.provider_id or o.external_order_id:
                results.append({ 'id': oid, 'success': False, 'message': 'already processed' })
                continue
            # Simulate minimal dispatch by setting provider_id and external_order_id
            o.provider_id = provider_id
            o.external_order_id = f"stub-{o.id}"
            o.external_status = 'sent'
            o.sent_at = timezone.now()
            if note:
                o.provider_message = (note or '')[:500]
            try:
                o.save(update_fields=['provider_id','external_order_id','external_status','sent_at','provider_message'])
            except Exception:
                o.save()
            results.append({ 'id': oid, 'success': True })
        ok_count = len([r for r in results if r.get('success')])
        return Response({ 'ok': True, 'count': ok_count, 'results': results })
