from __future__ import annotations

import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.db import IntegrityError, transaction
from django.db.models import Q, F
from django.db.utils import ProgrammingError
from django.utils import timezone
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
    AdminDepositTopupRequestSerializer,
    AdminDepositTopupResponseSerializer,
)
from .serializers import LOGO_DATA_URL_KEY
from rest_framework.parsers import MultiPartParser, FormParser
from apps.users.legacy_models import LegacyUser
from apps.users.serializers import build_currency_payload

logger = logging.getLogger(__name__)
MAX_LOGO_URL_LENGTH = 500


def _prepare_logo_and_config(raw_logo, config, *, preserve_hidden=False, existing_hidden=None):
    cfg = dict(config or {})
    if raw_logo is None:
        if preserve_hidden and existing_hidden and LOGO_DATA_URL_KEY not in cfg:
            cfg[LOGO_DATA_URL_KEY] = existing_hidden
        return None, cfg
    logo_value = str(raw_logo)
    if not logo_value:
        cfg.pop(LOGO_DATA_URL_KEY, None)
        return None, cfg
    if len(logo_value) > MAX_LOGO_URL_LENGTH:
        cfg[LOGO_DATA_URL_KEY] = logo_value
        return None, cfg
    cfg.pop(LOGO_DATA_URL_KEY, None)
    return logo_value, cfg


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

    def _is_unique_conflict(self, exc: Exception) -> bool:
        text = str(exc) if exc is not None else ''
        return 'duplicate key' in text.lower() or 'unique constraint' in text.lower()

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
        logo_value, config_payload = _prepare_logo_and_config(v.get('logoUrl'), v.get('config'))

        pm = PaymentMethod(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name=v['name'],
            is_active=bool(v.get('isActive', True)),
            type=v['type'],
            config=config_payload,
            logo_url=logo_value,
            note=v.get('note') or None,
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        )

        try:
            try:
                pm.save(force_insert=True)
            except IntegrityError as exc:
                if self._is_unique_conflict(exc):
                    raise ValidationError({'message': 'اسم وسيلة الدفع مستخدم مسبقًا داخل هذا المستأجر.'}) from exc
                raise
            except Exception:
                # Unmanaged: fallback to raw insert
                from django.db import connection
                import json

                config_payload = pm.config if pm.config is not None else {}
                if not isinstance(config_payload, (dict, list)):
                    # Ensure we store valid JSON structure even if serializer passed primitives
                    config_payload = {}
                config_json = json.dumps(config_payload)

                try:
                    with connection.cursor() as c:
                        try:
                            c.execute(
                                'INSERT INTO payment_method (id, "tenantId", name, type, "isActive", config, "logoUrl", note, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s,%s,NOW(),NOW())',
                                [str(pm.id), str(tenant_id), pm.name, pm.type, pm.is_active, config_json, pm.logo_url, pm.note]
                            )
                        except ProgrammingError:
                            c.execute(
                                'INSERT INTO payment_method (id, "tenantId", name, type, "isActive", config, "logoUrl", note, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
                                [str(pm.id), str(tenant_id), pm.name, pm.type, pm.is_active, config_json, pm.logo_url, pm.note]
                            )
                except IntegrityError as exc:
                    if self._is_unique_conflict(exc):
                        raise ValidationError({'message': 'اسم وسيلة الدفع مستخدم مسبقًا داخل هذا المستأجر.'}) from exc
                    raise

        except ValidationError:
            raise
        except Exception as exc:
            self.logger.exception('Failed to create payment method', extra={'tenantId': tenant_id, 'payload': v})
            raise ValidationError({'message': f'تعذر إنشاء وسيلة الدفع: {exc}'}) from exc

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
        s = AdminPaymentMethodUpsertSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        v = s.validated_data
        if 'name' in v:
            pm.name = v['name']
        if 'type' in v:
            pm.type = v['type']
        if 'isActive' in v:
            pm.is_active = bool(v['isActive'])

        config_input_present = 'config' in v
        current_config = dict(pm.config or {})
        if config_input_present:
            current_config = dict(v.get('config') or {})

        logo_input_present = 'logoUrl' in v
        existing_hidden_logo = (pm.config or {}).get(LOGO_DATA_URL_KEY) if isinstance(pm.config, dict) else None
        if logo_input_present:
            logo_value, current_config = _prepare_logo_and_config(v.get('logoUrl'), current_config)
            pm.logo_url = logo_value
        elif config_input_present:
            _, current_config = _prepare_logo_and_config(
                None,
                current_config,
                preserve_hidden=True,
                existing_hidden=existing_hidden_logo,
            )

        if config_input_present or logo_input_present:
            pm.config = current_config

        if 'note' in v:
            pm.note = v.get('note') or None
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

class AdminDepositTopupView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Payments"],
        request=AdminDepositTopupRequestSerializer,
        responses={200: AdminDepositTopupResponseSerializer},
    )
    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')

        serializer = AdminDepositTopupRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        user_id = payload['userId']
        method_id = payload['methodId']
        amount_input = payload['amount']
        note_raw = payload.get('note')

        try:
            amount_decimal = Decimal(amount_input)
        except Exception:
            raise ValidationError({'amount': 'المبلغ غير صالح'})

        if amount_decimal == 0:
            raise ValidationError({'amount': 'المبلغ يجب ألا يكون صفراً'})

        note_value = (note_raw or '').strip() or None

        try:
            user = LegacyUser.objects.get(id=user_id, tenant_id=tenant_id)
        except LegacyUser.DoesNotExist:
            raise NotFound('المستخدم غير موجود')

        try:
            method = PaymentMethod.objects.get(id=method_id)
        except PaymentMethod.DoesNotExist:
            raise ValidationError({'methodId': 'وسيلة الدفع غير موجودة'})

        if str(method.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذه الوسيلة')
        if not bool(getattr(method, 'is_active', True)):
            raise ValidationError({'methodId': 'وسيلة الدفع غير مفعّلة'})

        currency_payload = build_currency_payload(user)
        currency_code_raw = (currency_payload or {}).get('code') or getattr(user, 'preferred_currency_code', None)
        currency_code = str(currency_code_raw or '').strip().upper() or 'USD'

        amount_two_decimals = amount_decimal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if amount_two_decimals == 0:
            raise ValidationError({'amount': 'المبلغ بعد التقريب أصبح صفراً'})
        converted_amount = amount_two_decimals.quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
        rate_used = Decimal('1').quantize(Decimal('0.000001'))

        deposit_id = uuid.uuid4()
        now = timezone.now()

        with transaction.atomic():
            updated = LegacyUser.objects.filter(id=user_id, tenant_id=tenant_id).update(
                balance=F('balance') + amount_two_decimals
            )
            if not updated:
                raise ValidationError({'message': 'تعذر تحديث رصيد المستخدم'})

            deposit = Deposit(
                id=deposit_id,
                tenant_id=tenant_id,
                user_id=user_id,
                method_id=method_id,
                original_amount=converted_amount,
                original_currency=currency_code,
                wallet_currency=currency_code,
                rate_used=rate_used,
                converted_amount=converted_amount,
                note=note_value,
                status='approved',
                created_at=now,
                approved_at=now,
                source='admin_topup',
            )

            try:
                deposit.save(force_insert=True)
            except Exception:
                from django.db import connection

                try:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            (
                                'INSERT INTO deposit (id, "tenantId", user_id, method_id, "originalAmount", '
                                '"originalCurrency", "walletCurrency", "rateUsed", "convertedAmount", note, '
                                'status, "createdAt", "approvedAt", source) '
                                'VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)'
                            ),
                            [
                                str(deposit_id),
                                str(tenant_id),
                                str(user_id),
                                str(method_id),
                                str(converted_amount),
                                currency_code,
                                currency_code,
                                str(rate_used),
                                str(converted_amount),
                                note_value,
                                'approved',
                                now,
                                now,
                                'admin_topup',
                            ],
                        )
                except Exception as exc:
                    logger.exception('Failed to create admin top-up deposit', extra={'tenantId': tenant_id, 'userId': str(user_id)})
                    raise ValidationError({'message': 'تعذر إنشاء سجل الإيداع'}) from exc

            refreshed_user = LegacyUser.objects.get(id=user_id, tenant_id=tenant_id)

        balance_decimal = Decimal(refreshed_user.balance or 0).quantize(Decimal('0.000001'))

        deposit_payload = {
            'id': deposit_id,
            'userId': user_id,
            'methodId': method_id,
            'originalAmount': converted_amount,
            'originalCurrency': currency_code,
            'walletCurrency': currency_code,
            'rateUsed': rate_used,
            'convertedAmount': converted_amount,
            'note': note_value,
            'status': 'approved',
            'source': 'admin_topup',
            'createdAt': now,
            'approvedAt': now,
        }

        return Response({
            'ok': True,
            'balance': balance_decimal,
            'currency': currency_payload,
            'deposit': deposit_payload,
        })


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
