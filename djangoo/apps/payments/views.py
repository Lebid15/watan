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
    DepositCreateRequestSerializer,
)
from .serializers import LOGO_DATA_URL_KEY
from rest_framework.parsers import MultiPartParser, FormParser
from apps.users.legacy_models import LegacyUser
from apps.users.models import User as DjangoUser
from apps.users.serializers import build_currency_payload
from apps.currencies.models import Currency

logger = logging.getLogger(__name__)
MAX_LOGO_URL_LENGTH = 500


def _build_method_payload(method: PaymentMethod) -> dict:
    return {
        'id': str(getattr(method, 'id', '')),
        'name': getattr(method, 'name', None),
        'type': getattr(method, 'type', None),
    }


def _build_legacy_user_payload(user: LegacyUser) -> dict:
    full_name = getattr(user, 'full_name', None) or getattr(user, 'fullName', None)
    return {
        'id': str(getattr(user, 'id', '')),
        'email': getattr(user, 'email', None),
        'fullName': full_name,
        'username': getattr(user, 'username', None),
    }


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


def _resolve_legacy_user_for_request(request, user, tenant_id, *, required=True) -> LegacyUser | None:
    if not getattr(user, 'is_authenticated', False):
        if required:
            raise PermissionDenied('AUTH_REQUIRED')
        return None

    legacy_user: LegacyUser | None = None
    candidate_ids: set[uuid.UUID] = set()

    def _collect_candidate(raw_value) -> None:
        if not raw_value:
            return
        try:
            candidate_ids.add(uuid.UUID(str(raw_value)))
        except (ValueError, TypeError):
            logger.debug('Ignoring non-UUID legacy user candidate', extra={'value': raw_value})

    _collect_candidate(getattr(user, 'id', None))

    header_override = request.META.get('HTTP_X_LEGACY_USER_ID')
    if not header_override:
        try:
            header_override = request.headers.get('X-Legacy-User-Id')  # type: ignore[attr-defined]
        except Exception:
            header_override = None
    _collect_candidate(header_override)

    _collect_candidate(getattr(user, 'legacy_user_id', None))

    for candidate_id in candidate_ids:
        try:
            legacy_user = LegacyUser.objects.get(id=candidate_id, tenant_id=tenant_id)
            break
        except LegacyUser.DoesNotExist:
            continue

    if legacy_user is None:
        fallback_qs = LegacyUser.objects.filter(tenant_id=tenant_id)
        user_email = getattr(user, 'email', None)
        if user_email:
            legacy_user = fallback_qs.filter(email__iexact=user_email).first()
        if legacy_user is None:
            username = getattr(user, 'username', None)
            if username:
                legacy_user = fallback_qs.filter(username__iexact=username).first()

    if legacy_user is None:
        if required:
            raise NotFound('المستخدم غير موجود ضمن هذا المستأجر')
        return None

    return legacy_user


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
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')

        user = request.user
        limit = int(request.query_params.get('limit') or 20)
        limit = max(1, min(limit, 100))
        cursor = request.query_params.get('cursor') or None
        legacy_user = _resolve_legacy_user_for_request(request, user, tenant_id, required=False)
        if legacy_user is None:
            return Response({ 'items': [], 'pageInfo': { 'nextCursor': None, 'hasMore': False } })

        qs = Deposit.objects.filter(user_id=legacy_user.id).order_by('-created_at')
        if cursor:
            try:
                qs = qs.filter(created_at__lt=cursor)
            except Exception:
                pass
        items = list(qs[: limit + 1])
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = items[-1].created_at.isoformat() if has_more and items else None
        method_ids = {str(x.method_id) for x in items if getattr(x, 'method_id', None)}
        method_map: dict[str, dict] = {}
        if method_ids:
            for method in PaymentMethod.objects.filter(id__in=method_ids):
                method_map[str(method.id)] = _build_method_payload(method)

        context_payload = {
            'method_map': method_map,
            'user_map': {str(legacy_user.id): _build_legacy_user_payload(legacy_user)},
        }

        serializer = DepositListItemSerializer(
            items,
            many=True,
            context=context_payload,
        )

        return Response({ 'items': serializer.data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more } })

    @extend_schema(
        tags=["Payments"],
        request=DepositCreateRequestSerializer,
        responses={201: DepositDetailsSerializer},
    )
    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')

        serializer = DepositCreateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        user = request.user
        user_tenant = getattr(user, 'tenant_id', None)
        if user_tenant and str(user_tenant) != str(tenant_id):
            raise PermissionDenied('TENANT_MISMATCH')

        legacy_user = _resolve_legacy_user_for_request(request, user, tenant_id)

        method = None
        method_id = payload.get('methodId')
        if method_id:
            try:
                method = PaymentMethod.objects.get(id=method_id)
            except PaymentMethod.DoesNotExist:
                raise ValidationError({'methodId': 'وسيلة الدفع غير موجودة'})
            if str(method.tenant_id or '') != str(tenant_id):
                raise PermissionDenied('وسيلة الدفع غير متاحة ضمن هذا المستأجر')
            if not bool(getattr(method, 'is_active', True)):
                raise ValidationError({'methodId': 'وسيلة الدفع غير مفعّلة'})

        original_amount = Decimal(payload['originalAmount'])
        if original_amount <= 0:
            raise ValidationError({'originalAmount': 'المبلغ يجب أن يكون أكبر من صفر'})

        original_currency = str(payload['originalCurrency']).strip().upper()
        wallet_currency = str(payload['walletCurrency']).strip().upper()
        if not original_currency:
            raise ValidationError({'originalCurrency': 'العملة الأصلية مطلوبة'})
        if not wallet_currency:
            raise ValidationError({'walletCurrency': 'عملة المحفظة مطلوبة'})

        def _get_rate(code: str, field: str) -> Decimal:
            currency = Currency.objects.filter(tenant_id=tenant_id, code__iexact=code).first()
            if not currency:
                raise ValidationError({field: f'العملة {code} غير موجودة ضمن هذا المستأجر'})
            rate_raw = getattr(currency, 'rate', None)
            if rate_raw in (None, ''):
                rate_raw = getattr(currency, 'value', None)
            try:
                rate = Decimal(rate_raw)
            except Exception:
                raise ValidationError({field: f'قيمة سعر الصرف غير صالحة للعملة {code}'})
            if rate <= 0:
                raise ValidationError({field: f'سعر الصرف للعملة {code} يجب أن يكون أكبر من صفر'})
            return rate

        rate_from = _get_rate(original_currency, 'originalCurrency')
        rate_to = _get_rate(wallet_currency, 'walletCurrency')

        rate_ratio = (rate_to / rate_from).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
        converted_amount = (original_amount * rate_ratio).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
        original_amount_q = original_amount.quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)

        note_value = (payload.get('note') or '').strip() or None

        deposit_id = uuid.uuid4()
        now = timezone.now()

        legacy_user_id = legacy_user.id

        deposit = Deposit(
            id=deposit_id,
            tenant_id=tenant_id,
            user_id=legacy_user_id,
            method_id=(method.id if method else None),
            original_amount=original_amount_q,
            original_currency=original_currency,
            wallet_currency=wallet_currency,
            rate_used=rate_ratio,
            converted_amount=converted_amount,
            note=note_value,
            status='pending',
            created_at=now,
            approved_at=None,
            source='user_request',
        )
        try:
            deposit.save(force_insert=True)
        except Exception:
            from django.db import connection
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
                            str(legacy_user_id),
                            str(method.id) if method else None,
                            str(original_amount_q),
                            original_currency,
                            wallet_currency,
                            str(rate_ratio),
                            str(converted_amount),
                            note_value,
                            'pending',
                            now,
                            None,
                            'user_request',
                        ],
                    )

        try:
            saved = Deposit.objects.get(id=deposit_id)
        except Deposit.DoesNotExist:
            saved = deposit

        method_map = {}
        if method:
            method_map[str(method.id)] = _build_method_payload(method)

        user_map = {
            str(legacy_user.id): _build_legacy_user_payload(legacy_user),
        }

        return Response(
            DepositDetailsSerializer(
                saved,
                context={
                    'method_map': method_map,
                    'user_map': user_map,
                },
            ).data,
            status=201,
        )


class MyDepositDetailsView(APIView):
    """Get details of a single deposit for the authenticated user"""
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Payments"], responses={200: DepositDetailsSerializer})
    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        
        user = request.user
        legacy_user = _resolve_legacy_user_for_request(request, user, tenant_id, required=True)
        
        try:
            d = Deposit.objects.get(id=id)
        except Deposit.DoesNotExist:
            raise NotFound('الإيداع غير موجود')
        
        # تحقق من أن الإيداع يخص المستخدم الحالي
        if str(d.user_id) != str(legacy_user.id):
            raise PermissionDenied('لا تملك صلاحية على هذا الإيداع')
        
        # تحقق من أن الإيداع يخص نفس الـ tenant
        if str(d.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذا الإيداع')

        user_map = {str(legacy_user.id): _build_legacy_user_payload(legacy_user)}
        method_map = {}
        
        if getattr(d, 'method_id', None):
            try:
                method = PaymentMethod.objects.get(id=d.method_id)
                method_map[str(method.id)] = _build_method_payload(method)
            except PaymentMethod.DoesNotExist:
                pass

        return Response(
            DepositDetailsSerializer(
                d,
                context={
                    'user_map': user_map,
                    'method_map': method_map,
                },
            ).data
        )


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

        user_ids = {str(x.user_id) for x in items if getattr(x, 'user_id', None)}
        method_ids = {str(x.method_id) for x in items if getattr(x, 'method_id', None)}

        user_map: dict[str, dict] = {}
        if user_ids:
            for legacy_user in LegacyUser.objects.filter(id__in=user_ids, tenant_id=tenant_id):
                user_map[str(legacy_user.id)] = _build_legacy_user_payload(legacy_user)

        method_map: dict[str, dict] = {}
        if method_ids:
            for method in PaymentMethod.objects.filter(id__in=method_ids):
                method_map[str(method.id)] = _build_method_payload(method)

        data = AdminDepositListItemSerializer(
            items,
            many=True,
            context={
                'user_map': user_map,
                'method_map': method_map,
            },
        ).data
        return Response({ 'items': data, 'pageInfo': { 'nextCursor': next_cursor, 'hasMore': has_more } })

class AdminDepositTopupView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Payments"],
        request=AdminDepositTopupRequestSerializer,
        responses={200: AdminDepositTopupResponseSerializer},
    )
    def post(self, request):
        try:
            tenant_id = _resolve_tenant_id(request)
            if not tenant_id:
                logger.error("Admin topup: TENANT_ID_REQUIRED")
                raise ValidationError({'error': 'TENANT_ID_REQUIRED'})

            logger.info(
                "Admin topup request received",
                extra={
                    "tenant_id": tenant_id,
                    "request_data": request.data,
                },
            )

            serializer = AdminDepositTopupRequestSerializer(data=request.data)
            if not serializer.is_valid():
                logger.warning(
                    "Admin topup validation failed",
                    extra={
                        "errors": serializer.errors,
                        "request_data": request.data,
                    },
                )
                raise ValidationError(serializer.errors)
            
            payload = serializer.validated_data
        except ValidationError:
            raise
        except Exception as e:
            logger.exception("Unexpected error in admin topup", extra={"request_data": request.data})
            raise ValidationError({'error': str(e)})

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

        # البحث عن المستخدم - نحاول UUID أولاً، ثم integer ID
        user = None
        user_lookup_filters = {'tenant_id': tenant_id}

        try:
            user_uuid = uuid.UUID(str(user_id))
            user = LegacyUser.objects.filter(id=user_uuid, **user_lookup_filters).first()
        except (ValueError, AttributeError, TypeError):
            pass

        if user is None:
            try:
                user_int = int(str(user_id))
                user_dj = DjangoUser.objects.filter(id=user_int, tenant_id=tenant_id).first()
                if user_dj:
                    user = user_dj
                    logger.info(
                        "Admin topup: Using Django User (integer ID)",
                        extra={"user_id": user_int, "tenant_id": tenant_id}
                    )
            except (ValueError, TypeError):
                pass
        else:
            logger.info(
                "Admin topup: Using Legacy User (UUID)",
                extra={"user_id": str(user.id), "tenant_id": tenant_id}
            )

        if user is None:
            logger.warning(
                "Admin topup: User not found",
                extra={"user_id": str(user_id), "tenant_id": tenant_id},
            )
            raise NotFound('المستخدم غير موجود')

        try:
            method = PaymentMethod.objects.get(id=method_id)
        except PaymentMethod.DoesNotExist:
            logger.warning(
                "Admin topup: Payment method not found",
                extra={"method_id": str(method_id), "tenant_id": tenant_id},
            )
            raise ValidationError({'methodId': 'وسيلة الدفع غير موجودة'})

        if str(method.tenant_id or '') != str(tenant_id):
            raise PermissionDenied('لا تملك صلاحية على هذه الوسيلة')
        if not bool(getattr(method, 'is_active', True)):
            raise ValidationError({'methodId': 'وسيلة الدفع غير مفعّلة'})

        # حدد المستخدمين في النظام القديم والجديد لضمان المزامنة والتعامل مع المحفظة
        legacy_user_target: LegacyUser | None = user if isinstance(user, LegacyUser) else None
        django_user_target: DjangoUser | None = user if isinstance(user, DjangoUser) else None

        def _find_legacy_for_django(dj_user: DjangoUser | None) -> LegacyUser | None:
            if dj_user is None:
                return None
            lookup = LegacyUser.objects.filter(tenant_id=tenant_id)
            raw_legacy_id = getattr(dj_user, 'legacy_user_id', None)
            if raw_legacy_id:
                try:
                    legacy = lookup.filter(id=uuid.UUID(str(raw_legacy_id))).first()
                    if legacy:
                        return legacy
                except (ValueError, TypeError):
                    pass
            username = getattr(dj_user, 'username', None)
            if username:
                legacy = lookup.filter(username__iexact=username).first()
                if legacy:
                    return legacy
            email = getattr(dj_user, 'email', None)
            if email:
                legacy = lookup.filter(email__iexact=email).first()
                if legacy:
                    return legacy
            return None

        def _find_django_for_legacy(legacy_user: LegacyUser | None) -> DjangoUser | None:
            if legacy_user is None:
                return None
            lookup = DjangoUser.objects.filter(tenant_id=tenant_id)
            email = getattr(legacy_user, 'email', None)
            if email:
                dj = lookup.filter(email__iexact=email).first()
                if dj:
                    return dj
            username = getattr(legacy_user, 'username', None)
            if username:
                dj = lookup.filter(username__iexact=username).first()
                if dj:
                    return dj
            return None

        if legacy_user_target is None:
            legacy_user_target = _find_legacy_for_django(django_user_target)
        if django_user_target is None:
            django_user_target = _find_django_for_legacy(legacy_user_target)

        if legacy_user_target is None:
            logger.error(
                "Admin topup: Unable to resolve legacy user for target",
                extra={"tenant_id": str(tenant_id), "user_id": str(user_id)},
            )
            raise ValidationError({'userId': 'تعذر العثور على المستخدم في قاعدة البيانات القديمة لهذا المستأجر'})

        currency_source = django_user_target if isinstance(django_user_target, DjangoUser) else user
        currency_payload = build_currency_payload(currency_source) if isinstance(currency_source, DjangoUser) else None
        currency_code_raw = (currency_payload or {}).get('code')
        if not currency_code_raw:
            currency_code_raw = getattr(currency_source, 'preferred_currency_code', None) or getattr(currency_source, 'currency', None)
        currency_code = str(currency_code_raw or '').strip().upper() or 'USD'

        amount_two_decimals = amount_decimal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if amount_two_decimals == 0:
            raise ValidationError({'amount': 'المبلغ بعد التقريب أصبح صفراً'})
        converted_amount = amount_two_decimals.quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
        rate_used = Decimal('1').quantize(Decimal('0.000001'))

        deposit_id = uuid.uuid4()
        now = timezone.now()

        django_balance_before = None
        legacy_balance_before = None
        deposit_record: Deposit | None = None

        with transaction.atomic():
            legacy_locked = LegacyUser.objects.select_for_update().filter(id=legacy_user_target.id, tenant_id=tenant_id).first()
            if not legacy_locked:
                raise ValidationError({'userId': 'المستخدم غير موجود ضمن هذا المستأجر'})
            legacy_balance_before = Decimal(str(legacy_locked.balance or 0))
            legacy_locked.balance = (legacy_balance_before + amount_two_decimals).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            legacy_locked.save(update_fields=['balance'])
            legacy_user_target = legacy_locked

            if django_user_target:
                django_locked = DjangoUser.objects.select_for_update().filter(id=django_user_target.id, tenant_id=tenant_id).first()
                if not django_locked:
                    raise ValidationError({'userId': 'المستخدم غير موجود ضمن هذا المستأجر'})
                django_balance_before = Decimal(str(django_locked.balance or 0))
                django_locked.balance = (django_balance_before + converted_amount).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
                django_locked.save(update_fields=['balance'])
                django_user_target = django_locked

            deposit_record = Deposit(
                id=deposit_id,
                tenant_id=tenant_id,
                user_id=legacy_user_target.id,
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
                deposit_record.save(force_insert=True)
                logger.info("Deposit created successfully via ORM", extra={"deposit_id": str(deposit_id)})
            except Exception as orm_error:
                logger.warning(
                    "ORM deposit creation failed, trying raw SQL",
                    extra={
                        "error": str(orm_error),
                        "deposit_id": str(deposit_id),
                        "legacy_user_id": str(legacy_user_target.id),
                    }
                )
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
                                str(legacy_user_target.id),
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
                        logger.info("Deposit created successfully via raw SQL", extra={"deposit_id": str(deposit_id)})
                except Exception as exc:
                    logger.exception(
                        'Failed to create admin top-up deposit (both ORM and raw SQL)',
                        extra={
                            'tenantId': str(tenant_id),
                            'userId': str(user_id),
                            'legacy_user_id': str(legacy_user_target.id),
                            'orm_error': str(orm_error),
                            'sql_error': str(exc),
                        }
                    )
                    raise ValidationError({'message': 'تعذر إنشاء سجل الإيداع', 'detail': str(exc)}) from exc

            if django_user_target:
                from apps.users.wallet_helpers import record_wallet_transaction

                description_parts = [
                    "شحن المحفظة (إداري)",
                    f"{converted_amount} {currency_code}",
                ]
                if getattr(method, 'name', None):
                    description_parts.append(f"وسيلة الدفع: {method.name}")
                if note_value:
                    description_parts.append(f"ملاحظة: {note_value[:120]}")

                metadata_payload = {
                    'deposit_id': str(deposit_id),
                    'legacy_user_id': str(legacy_user_target.id),
                    'source': 'admin_topup',
                    'method_id': str(method_id),
                    'note': note_value[:120] if note_value else None,
                    'auto_approved': True,
                }

                record_wallet_transaction(
                    user=django_user_target,
                    transaction_type='deposit',
                    amount=converted_amount,
                    description="\n".join(description_parts),
                    payment_id=str(deposit_id),
                    balance_before=django_balance_before,
                    created_by=request.user if getattr(request, 'user', None) else None,
                    metadata={k: v for k, v in metadata_payload.items() if v is not None},
                )

        target_for_balance = django_user_target or legacy_user_target
        balance_decimal = Decimal(str(getattr(target_for_balance, 'balance', 0) or 0)).quantize(Decimal('0.000001'))

        deposit_payload = {
            'id': str(deposit_id),
            'userId': str(user_id),
            'legacyUserId': str(legacy_user_target.id),
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
        user_map = {}
        try:
            legacy_user = LegacyUser.objects.get(id=d.user_id, tenant_id=tenant_id)
        except LegacyUser.DoesNotExist:
            legacy_user = None
        if legacy_user is not None:
            user_map[str(legacy_user.id)] = _build_legacy_user_payload(legacy_user)

        method_map = {}
        if getattr(d, 'method_id', None):
            try:
                method = PaymentMethod.objects.get(id=d.method_id)
            except PaymentMethod.DoesNotExist:
                method = None
            if method is not None:
                method_map[str(method.id)] = _build_method_payload(method)

        return Response(
            DepositDetailsSerializer(
                d,
                context={
                    'user_map': user_map,
                    'method_map': method_map,
                },
            ).data
        )

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

        try:
            legacy_user_obj = LegacyUser.objects.get(id=d.user_id, tenant_id=tenant_id)
        except LegacyUser.DoesNotExist:
            legacy_user_obj = None

        action = str(request.data.get('status') or '').strip()
        note = str(request.data.get('note') or '').strip()
        if action not in ('approved','rejected'):
            raise ValidationError('الحالة غير صحيحة')

        prev_status = d.status
        d.status = action
        if note:
            # append note text to existing note field if present
            d.note = (note if not d.note else (str(d.note) + '\n' + note))[:1000]
        update_fields = ['status']
        if note:
            update_fields.append('note')

        converted = getattr(d, 'converted_amount', None)
        try:
            amount_value = Decimal(converted or 0)
        except Exception:
            amount_value = Decimal('0')

        balance_delta = Decimal('0')
        if action == 'approved' and prev_status != 'approved':
            if not getattr(d, 'approved_at', None):
                d.approved_at = timezone.now()
                update_fields.append('approved_at')
            balance_delta = amount_value
        elif action == 'rejected' and prev_status == 'approved':
            if getattr(d, 'approved_at', None):
                d.approved_at = None
                update_fields.append('approved_at')
            balance_delta = -amount_value

        django_wallet_user = None
        django_balance_before = None

        with transaction.atomic():
            d.save(update_fields=update_fields)
            if balance_delta != 0:
                updated = LegacyUser.objects.filter(id=d.user_id, tenant_id=tenant_id).update(
                    balance=F('balance') + balance_delta
                )
                if not updated:
                    logger.warning('Failed to adjust legacy user balance for deposit %s', str(d.id))
                else:
                    match_filters = Q()
                    if legacy_user_obj is not None:
                        if getattr(legacy_user_obj, 'id', None):
                            match_filters |= Q(id=legacy_user_obj.id)
                        email_val = getattr(legacy_user_obj, 'email', None)
                        if email_val:
                            match_filters |= Q(email__iexact=email_val)
                        username_val = getattr(legacy_user_obj, 'username', None)
                        if username_val:
                            match_filters |= Q(username__iexact=username_val)
                    if match_filters:
                        qs = DjangoUser.objects.select_for_update().filter(Q(tenant_id=tenant_id) & match_filters)
                        django_wallet_user = qs.first()
                        if django_wallet_user is not None:
                            try:
                                django_balance_before = Decimal(str(django_wallet_user.balance or 0))
                            except Exception:
                                django_balance_before = None
                        qs.update(balance=F('balance') + balance_delta)
            should_record_wallet_tx = balance_delta != 0 and django_wallet_user is not None

        if should_record_wallet_tx:
            try:
                from apps.users.wallet_helpers import record_wallet_transaction

                django_wallet_user.refresh_from_db()

                if django_balance_before is None:
                    try:
                        current_balance = Decimal(str(django_wallet_user.balance or 0))
                    except Exception:
                        current_balance = Decimal('0')
                    django_balance_before = current_balance - balance_delta

                currency_code = (
                    getattr(d, 'wallet_currency', None)
                    or getattr(d, 'original_currency', None)
                    or 'USD'
                )

                amount_for_record = abs(balance_delta)
                is_deposit = balance_delta > 0
                description_parts = [
                    "شحن المحفظة (إيداع)" if is_deposit else "إلغاء شحن المحفظة (رفض الإيداع)",
                    f"{amount_for_record} {currency_code}",
                ]
                if getattr(d, 'method_id', None):
                    description_parts.append(f"وسيلة الدفع: {d.method_id}")
                if note:
                    description_parts.append(f"ملاحظة: {note[:120]}")

                metadata_payload = {
                    'deposit_id': str(d.id),
                    'source': getattr(d, 'source', None),
                    'method_id': str(getattr(d, 'method_id', '') or ''),
                    'previous_status': prev_status,
                    'new_status': action,
                    'approved_at': d.approved_at.isoformat() if getattr(d, 'approved_at', None) else None,
                    'balance_delta': str(balance_delta),
                }
                if not is_deposit:
                    metadata_payload['status_change'] = True

                record_wallet_transaction(
                    user=django_wallet_user,
                    transaction_type='deposit' if is_deposit else 'deposit_reversal',
                    amount=amount_for_record,
                    description="\n".join(description_parts),
                    payment_id=str(d.id),
                    balance_before=django_balance_before,
                    metadata=metadata_payload,
                )
            except Exception as exc:
                logger.warning(
                    "Failed to record wallet transaction for deposit status change",
                    extra={"deposit_id": str(d.id), "error": str(exc)},
                )

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
