import uuid
import logging
from decimal import Decimal, InvalidOperation

import bcrypt
from argon2.low_level import Type, verify_secret

from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError, NotFound
from django.db import transaction
from django.db.models import Q
from django.contrib.auth import authenticate, get_user_model
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from django.conf import settings
from django.utils import timezone as django_timezone
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import (
    UserProfileSerializer, UserProfileWithCurrencySerializer,
    AdminUserSerializer,
    build_currency_payload,
)
from .password_reset import (
    consume_password_reset_token,
    create_password_reset_token,
    send_password_reset_email,
)
from apps.products.views import _resolve_tenant_id
from apps.currencies.models import Currency


logger = logging.getLogger(__name__)


UserModel = get_user_model()


def _user_detail_payload(user) -> dict:
    currency_payload = build_currency_payload(user)
    currency_code = None
    if currency_payload and currency_payload.get('code'):
        currency_code = currency_payload['code']
    else:
        raw_code = getattr(user, 'preferred_currency_code', None) or getattr(user, 'currency', None)
        currency_code = str(raw_code).strip().upper() if raw_code else None

    full_name = user.full_name
    if not full_name:
        parts = [user.first_name or '', user.last_name or '']
        full_name = ' '.join(part for part in parts if part).strip() or None

    status_value = getattr(user, 'status', None)
    is_active = True
    try:
        if status_value is not None and hasattr(UserModel, 'Status'):
            is_active = status_value != UserModel.Status.DISABLED
        else:
            is_active = bool(getattr(user, 'is_active', True))
    except Exception:
        is_active = bool(getattr(user, 'is_active', True))

    overdraft_value = getattr(user, 'overdraft', None)
    overdraft_limit = getattr(user, 'overdraft_limit', None)
    if overdraft_value in (None, '') and overdraft_limit not in (None, ''):
        overdraft_value = overdraft_limit

    return {
        'id': str(user.id),
        'email': user.email,
        'username': user.username,
        'fullName': full_name,
        'firstName': user.first_name,
        'lastName': user.last_name,
        'phoneNumber': user.phone_number,
        'countryCode': user.country_code,
        'role': (user.role or 'user').lower(),
        'isActive': is_active,
        'balance': float(user.balance or 0),
        'overdraftLimit': float(overdraft_value or 0),
        'currency': currency_payload,
        'currencyCode': currency_code,
        'currency_code': currency_code,
        'tenantId': str(user.tenant_id) if user.tenant_id else None,
        'priceGroupId': str(user.price_group_id) if user.price_group_id else None,
        'priceGroup': {'id': str(user.price_group_id)} if user.price_group_id else None,
        'address': getattr(user, 'address', ''),  # جديد
        'documents': getattr(user, 'documents', []),  # جديد
    }


def _normalize_uuid(value):
    if value in (None, ''):
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _require_tenant_uuid(raw_tenant_id):
    tenant_uuid = _normalize_uuid(raw_tenant_id)
    if tenant_uuid is None:
        raise ValidationError('TENANT_ID_INVALID')
    return tenant_uuid


def _get_user_for_tenant_or_404(user_id, tenant_id):
    qs = UserModel.objects.all()
    tenant_uuid = _normalize_uuid(tenant_id)
    if tenant_uuid is not None:
        qs = qs.filter(tenant_id=tenant_uuid)

    user_uuid = _normalize_uuid(user_id)
    if user_uuid is not None:
        try:
            return qs.get(id=user_uuid)
        except UserModel.DoesNotExist:
            pass

    try:
        return qs.get(id=user_id)
    except (UserModel.DoesNotExist, ValueError, TypeError):
        raise NotFound('المستخدم غير موجود')


def _verify_legacy_hash(password: str, hashed: str) -> bool:
    if not password or not hashed:
        return False
    try:
        if hashed.startswith('$argon2'):
            return bool(verify_secret(hashed.encode('utf-8'), password.encode('utf-8'), type=Type.ID))
        if hashed.startswith('$2'):
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        logger.warning('Failed to verify legacy password hash', exc_info=True)
        return False
    return False


def _set_auth_cookies(response: Response, token: str, request) -> None:
    if not token:
        return
    max_age = 60 * 60 * 12  # 12 hours
    secure_default = bool(getattr(settings, 'AUTH_COOKIE_SECURE', False))
    domain = getattr(settings, 'AUTH_COOKIE_DOMAIN', None)
    host = None
    try:
        host = (request.get_host() or '').split(':')[0]
    except Exception:
        host = None
    secure = secure_default
    if not domain and host and host not in ('localhost', '127.0.0.1'):
        domain = host
    if domain and domain.endswith('.localhost'):
        domain = None
    if domain:
        secure = True  # cross-site cookies require secure flag
    same_site = 'None' if secure else 'Lax'
    cookie_args = {
        'max_age': max_age,
        'httponly': True,
        'secure': secure,
        'samesite': same_site,
        'path': '/',
    }
    if domain:
        cookie_args['domain'] = domain
    response.set_cookie('auth', token, **cookie_args)
    non_http_only_args = {k: v for k, v in cookie_args.items() if k != 'httponly'}
    response.set_cookie('access_token', token, httponly=False, **non_http_only_args)


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def profile(request):
    user = request.user
    if request.method == "PUT":
        allowed_fields = {k: v for k, v in request.data.items() if k in ["first_name", "last_name", "full_name", "phone_number", "country_code"]}
        serializer = UserProfileSerializer(user, data=allowed_fields, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
    return Response(_user_detail_payload(user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile_with_currency(request):
    user = request.user
    data = UserProfileWithCurrencySerializer(user).data
    currency_code = data.get('currency_code') or data.get('currency')
    if currency_code:
        data['currencyCode'] = currency_code
    price_group_id = getattr(user, 'price_group_id', None)
    data['priceGroupId'] = str(price_group_id) if price_group_id else None
    data['price_group_id'] = str(price_group_id) if price_group_id else None
    data['priceGroup'] = {'id': str(price_group_id)} if price_group_id else None
    data['fullName'] = getattr(user, 'full_name', None)
    data['role'] = (getattr(user, 'role', '') or 'user').lower()
    data['isActive'] = bool(getattr(user, 'is_active', True))
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_users(request):
    tenant_raw = _resolve_tenant_id(request)
    if not tenant_raw:
        raise ValidationError('TENANT_ID_REQUIRED')
    tenant_id = _require_tenant_uuid(tenant_raw)
    qs = UserModel.objects.filter(tenant_id=tenant_id)
    # optional search by q
    q = (request.query_params.get('q') or '').strip()
    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q))
    serializer = AdminUserSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def users_with_price_group(request):
    tenant_raw = _resolve_tenant_id(request)
    if not tenant_raw:
        raise ValidationError('TENANT_ID_REQUIRED')
    tenant_id = _require_tenant_uuid(tenant_raw)
    qs = UserModel.objects.filter(tenant_id=tenant_id, price_group_id__isnull=False)
    serializer = AdminUserSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def set_user_price_group(request, id: str):
    tenant_raw = _resolve_tenant_id(request)
    if not tenant_raw:
        raise ValidationError('TENANT_ID_REQUIRED')
    tenant_id = _require_tenant_uuid(tenant_raw)
    user = _get_user_for_tenant_or_404(id, tenant_id)
    price_group_id = request.data.get('priceGroupId', None)
    if price_group_id in ('', None):
        user.price_group_id = None
    else:
        try:
            user.price_group_id = _normalize_uuid(price_group_id) or uuid.UUID(str(price_group_id))
        except (ValueError, TypeError):
            raise ValidationError('priceGroupId غير صالح')
    user.save(update_fields=['price_group_id'])
    return Response({'ok': True})


@api_view(["GET", "PUT", "DELETE"])  # ✅ أضفنا DELETE
@permission_classes([IsAuthenticated])
def legacy_user_detail(request, id: str):
    tenant_raw = _resolve_tenant_id(request)
    if not tenant_raw:
        raise ValidationError('TENANT_ID_REQUIRED')
    tenant_id = _require_tenant_uuid(tenant_raw)
    user = _get_user_for_tenant_or_404(id, tenant_id)

    if request.method == "GET":
        return Response(_user_detail_payload(user))

    if request.method == "DELETE":
        # حذف المستخدم من كلا الجدولين
        username = user.username
        user_id = user.id
        
        # حذف من LegacyUser (users table) أولاً
        try:
            from apps.orders.models import LegacyUser
            LegacyUser.objects.filter(
                tenant_id=tenant_id,
                username__iexact=username
            ).delete()
            logger.info(f'✅ Deleted LegacyUser username={username}, tenant_id={tenant_id}')
        except Exception as e:
            logger.warning(f'⚠️ Failed to delete LegacyUser: {str(e)}')
        
        # حذف من User (dj_users table)
        user.delete()
        logger.info(f'✅ Deleted User id={user_id}, username={username}, tenant_id={tenant_id}')
        
        return Response({'message': 'تم حذف المستخدم بنجاح'}, status=status.HTTP_200_OK)

    payload = request.data or {}
    username = (payload.get('username') or '').strip() or None
    full_name = (payload.get('fullName') or '').strip() or None
    phone_number = (payload.get('phoneNumber') or '').strip() or None
    country_code = (payload.get('countryCode') or '').strip() or None
    address = payload.get('address')  # جديد
    role_raw = (payload.get('role') or payload.get('roleFinal') or user.role or 'user')
    role = str(role_raw).lower()
    is_active = payload.get('isActive')

    updates = {}
    if username is not None:
        updates['username'] = username
    if full_name is not None:
        updates['full_name'] = full_name
    if phone_number is not None:
        updates['phone_number'] = phone_number
    if country_code is not None:
        updates['country_code'] = country_code
    if address is not None:  # جديد
        updates['address'] = address

    if role:
        valid_roles = set(getattr(UserModel, 'Roles').values) if hasattr(UserModel, 'Roles') else None
        normalized_role = role
        if valid_roles and normalized_role not in valid_roles:
            raise ValidationError('دور المستخدم غير صالح')
        updates['role'] = normalized_role

    if is_active is not None:
        is_active_bool = bool(is_active)
        if hasattr(UserModel, 'Status'):
            updates['status'] = UserModel.Status.ACTIVE if is_active_bool else UserModel.Status.DISABLED
        else:
            updates['is_active'] = is_active_bool

    if updates:
        for field, value in updates.items():
            setattr(user, field, value)
        user.save(update_fields=list(updates.keys()))

    return Response(_user_detail_payload(user))


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def legacy_user_set_password(request, id: str):
    tenant_raw = _resolve_tenant_id(request)
    if not tenant_raw:
        raise ValidationError('TENANT_ID_REQUIRED')
    tenant_id = _require_tenant_uuid(tenant_raw)
    user = _get_user_for_tenant_or_404(id, tenant_id)
    password = (request.data.get('password') or '').strip()
    if not password:
        raise ValidationError('كلمة المرور مطلوبة')
    if len(password) < 6:
        raise ValidationError('كلمة المرور قصيرة جداً')
    user.set_password(password)
    if hasattr(user, 'legacy_password_hash'):
        user.legacy_password_hash = ''
    user.save(update_fields=['password', 'legacy_password_hash'] if hasattr(user, 'legacy_password_hash') else ['password'])
    return Response({'ok': True})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def legacy_user_set_overdraft(request, id: str):
    tenant_raw = _resolve_tenant_id(request)
    if not tenant_raw:
        raise ValidationError('TENANT_ID_REQUIRED')
    tenant_id = _require_tenant_uuid(tenant_raw)
    user = _get_user_for_tenant_or_404(id, tenant_id)

    raw_value = request.data.get('overdraftLimit')
    if raw_value in (None, ''):
        value = Decimal('0')
    else:
        try:
            value = Decimal(str(raw_value))
        except (InvalidOperation, ValueError):
            raise ValidationError('overdraftLimit غير صالح')
    if hasattr(user, 'overdraft'):
        user.overdraft = value
        update_fields = ['overdraft']
    else:
        user.overdraft_limit = value
        update_fields = ['overdraft_limit']
    user.save(update_fields=update_fields)
    return Response({'ok': True, 'overdraftLimit': float(value or 0)})


@api_view(["POST"])
@permission_classes([AllowAny])
def request_password_reset(request):
    data = request.data or {}
    identifier = (data.get('emailOrUsername') or data.get('email') or data.get('username') or '').strip()
    tenant_code = (data.get('tenantCode') or '').strip()
    if not identifier:
        return Response({'message': 'emailOrUsername required'}, status=status.HTTP_400_BAD_REQUEST)

    tenant_id = _resolve_tenant_id(request)
    tenant_uuid = _normalize_uuid(tenant_id)
    if not tenant_uuid and tenant_code:
        try:
            from apps.tenants.models import Tenant as LegacyTenant

            tenant = LegacyTenant.objects.filter(code__iexact=tenant_code).first()
            if tenant and getattr(tenant, 'is_active', True):
                tenant_uuid = _normalize_uuid(getattr(tenant, 'id', None))
        except Exception:
            logger.warning('Failed to resolve tenant by code %s', tenant_code, exc_info=True)

    def match_user(qs):
        try:
            return qs.filter(email__iexact=identifier).first() or qs.filter(username__iexact=identifier).first()
        except Exception:
            return None

    user = None
    base_qs = UserModel.objects.all()
    if tenant_uuid:
        user = match_user(base_qs.filter(tenant_id=tenant_uuid))
    if not user:
        user = match_user(base_qs.filter(tenant_id__isnull=True))
    if not user:
        user = match_user(base_qs)
        if user:
            logger.info('Password reset fallback matched user %s without tenant scoping', user.id)

    tenant_host = request.META.get(getattr(settings, 'TENANT_HEADER', 'HTTP_X_TENANT_HOST')) or request.META.get('HTTP_HOST')

    if user:
        try:
            raw_token = create_password_reset_token(user.id, getattr(user, 'tenant_id', None))
            send_password_reset_email(user.email, raw_token, tenant_host=tenant_host)
            logger.info('Password reset token issued for user %s', user.id)
        except Exception as exc:
            logger.warning('Password reset generation failed for user %s: %s', getattr(user, 'id', None), exc, exc_info=True)
    else:
        logger.info('Password reset requested for unknown identifier "%s"', identifier)

    return Response({'ok': True})


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    data = request.data or {}
    token = (data.get('token') or '').strip()
    new_password = (data.get('newPassword') or '').strip()
    if not token or not new_password:
        return Response({'message': 'token & newPassword required'}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 6:
        return Response({'message': 'weak password'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        token_entry = consume_password_reset_token(token)
        if not token_entry:
            return Response({'message': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)
        user = None
        raw_user_id = token_entry.user_id
        user_uuid = _normalize_uuid(raw_user_id)
        if user_uuid:
            user = UserModel.objects.filter(id=user_uuid).first()
            if not user:
                try:
                    user = UserModel.objects.filter(id=user_uuid.int).first()
                except (AttributeError, ValueError):
                    user = None
        if not user:
            try:
                user_id_int = int(str(raw_user_id))
                user = UserModel.objects.filter(id=user_id_int).first()
            except (ValueError, TypeError):
                user = None

        if not user:
            token_entry.used_at = django_timezone.now()
            token_entry.save(update_fields=['used_at'])
            logger.warning('Password reset token %s references missing user %s', token_entry.id, token_entry.user_id)
            return Response({'message': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        if hasattr(user, 'legacy_password_hash'):
            user.legacy_password_hash = ''
        save_fields = ['password']
        if hasattr(user, 'legacy_password_hash'):
            save_fields.append('legacy_password_hash')
        user.save(update_fields=save_fields)
        token_entry.used_at = django_timezone.now()
        token_entry.save(update_fields=['used_at'])

    logger.info('Password reset completed for user %s', token_entry.user_id)
    return Response({'ok': True})


class LoginView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def post(self, request):
        # Accept multiple field names for identifier compatibility
        data = request.data or {}
        identifier = data.get('emailOrUsername') or data.get('username') or data.get('email')
        password = data.get('password')
        if not identifier or not password:
            return Response({ 'message': 'Missing credentials' }, status=status.HTTP_400_BAD_REQUEST)

        tenant_id = _resolve_tenant_id(request)
        tenant_uuid = _normalize_uuid(tenant_id)

        user = authenticate(request, username=identifier, password=password)
        if user is None and '@' in str(identifier):
            try:
                candidate = UserModel.objects.get(email__iexact=identifier)
                user = authenticate(request, username=candidate.username, password=password)
            except UserModel.DoesNotExist:
                user = None

        if user is None:
            candidate_qs = UserModel.objects.all()
            if tenant_uuid:
                candidate_qs = candidate_qs.filter(tenant_id=tenant_uuid)
            if '@' in str(identifier):
                candidate = candidate_qs.filter(email__iexact=identifier).first()
                if not candidate:
                    candidate = UserModel.objects.filter(email__iexact=identifier).first()
            else:
                candidate = candidate_qs.filter(username__iexact=identifier).first()

            if candidate and _verify_legacy_hash(password, getattr(candidate, 'legacy_password_hash', '')):
                candidate.set_password(password)
                if hasattr(candidate, 'legacy_password_hash'):
                    candidate.legacy_password_hash = ''
                    candidate.save(update_fields=['password', 'legacy_password_hash'])
                else:
                    candidate.save(update_fields=['password'])
                user = candidate

        if user is None:
            return Response({'message': 'بيانات الاعتماد غير صحيحة'}, status=status.HTTP_401_UNAUTHORIZED)

        if hasattr(user, 'status') and getattr(UserModel, 'Status', None):
            if user.status == UserModel.Status.DISABLED:
                return Response({'message': 'الحساب غير نشط'}, status=status.HTTP_403_FORBIDDEN)

        # jwt pair with extra claims for client-side routing
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        try:
            role_val = getattr(user, 'role', None)
            if hasattr(role_val, 'value'):
                role_val = role_val.value  # TextChoices
            if role_val:
                access_token['role'] = str(role_val)
        except Exception:
            pass
        try:
            if getattr(user, 'email', None):
                access_token['email'] = user.email
        except Exception:
            pass
        access = str(access_token)
        body = {
            'access': access,
            'refresh': str(refresh),
            # Aliases expected by the frontend
            'token': access,
            'access_token': access,
            'user': _user_detail_payload(user),
            'requiresTotp': False,
            'totpPending': False,
        }
        response = Response(body)
        _set_auth_cookies(response, access, request)
        return response


class RegisterContextView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Debug logging
        logger.info('RegisterContextView: Headers - X-Tenant-Host: %s, Host: %s, Origin: %s', 
                   request.META.get('HTTP_X_TENANT_HOST'), 
                   request.META.get('HTTP_HOST'),
                   request.META.get('HTTP_ORIGIN'))
        
        tenant_raw = _resolve_tenant_id(request)
        logger.info('RegisterContextView: _resolve_tenant_id returned: %s', tenant_raw)
        
        if not tenant_raw:
            # Try to resolve from HTTP_HOST header if X-Tenant-Host is missing
            host_header = request.META.get('HTTP_HOST')
            if host_header:
                host = host_header.split(':')[0]
                try:
                    from apps.tenants.models import TenantDomain
                    dom = TenantDomain.objects.filter(domain=host).order_by('-is_primary').first()
                    if dom and getattr(dom, 'tenant_id', None):
                        tenant_raw = str(dom.tenant_id)
                        logger.info('RegisterContextView: Resolved tenant_id %s from Host header %s', tenant_raw, host)
                except Exception:
                    logger.exception('Failed to resolve tenant from Host header')
            
            if not tenant_raw:
                # Return empty currencies list if no tenant is resolved
                # This allows frontend to work even without proper tenant setup
                logger.warning('RegisterContextView: No tenant_id resolved from request (Host: %s)', request.META.get('HTTP_HOST'))
                return Response({'currencies': []})
        
        try:
            tenant_id = _require_tenant_uuid(tenant_raw)
        except ValidationError:
            logger.warning('RegisterContextView: Invalid tenant_id format: %s', tenant_raw)
            return Response({'currencies': []})

        currencies = (
            Currency.objects
            .filter(tenant_id=tenant_id, is_active=True)
            .order_by('name')
        )
        data = [
            {
                'id': str(c.id),
                'name': c.name,
                'code': c.code,
                'symbolAr': c.symbol_ar,
                'isPrimary': bool(c.is_primary),
            }
            for c in currencies
        ]
        return Response({'currencies': data})


class RegisterView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        tenant_raw = _resolve_tenant_id(request)
        if not tenant_raw:
            logger.warning('RegisterView: No tenant_id resolved from request')
            raise ValidationError('TENANT_ID_REQUIRED')
        tenant_id = _require_tenant_uuid(tenant_raw)

        payload = request.data or {}
        email_raw = (payload.get('email') or '').strip()
        password = (payload.get('password') or '').strip()
        full_name = (payload.get('fullName') or '').strip()
        username = (payload.get('username') or '').strip()
        currency_id_raw = (payload.get('currencyId') or '').strip()
        phone_number = (payload.get('phoneNumber') or '').strip() or None
        country_code = (payload.get('countryCode') or '').strip() or None

        missing_fields = [field for field, value in (
            ('email', email_raw),
            ('password', password),
            ('fullName', full_name),
            ('username', username),
            ('currencyId', currency_id_raw),
        ) if not value]
        if missing_fields:
            return Response(
                {'message': 'حقول مطلوبة مفقودة', 'missing': missing_fields},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_email(email_raw)
        except DjangoValidationError:
            raise ValidationError('البريد الإلكتروني غير صالح')
        email = email_raw.lower()

        if len(password) < 6:
            raise ValidationError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')

        try:
            currency_uuid = uuid.UUID(currency_id_raw)
        except (ValueError, TypeError):
            raise ValidationError('مُعرّف العملة غير صالح')

        currency = Currency.objects.filter(id=currency_uuid, tenant_id=tenant_id, is_active=True).first()
        if not currency:
            raise ValidationError('العملة غير متاحة أو غير فعّالة')

        if UserModel.objects.filter(tenant_id=tenant_id, email__iexact=email).exists():
            return Response({'message': 'البريد الإلكتروني مستخدم مسبقًا'}, status=status.HTTP_409_CONFLICT)

        if UserModel.objects.filter(tenant_id=tenant_id, username__iexact=username).exists():
            return Response({'message': 'اسم المستخدم مستخدم مسبقًا'}, status=status.HTTP_409_CONFLICT)

        # تحضير البيانات قبل الإنشاء
        first_name = (payload.get('firstName') or '').strip()
        last_name = (payload.get('lastName') or '').strip()
        if not first_name and not last_name and full_name:
            parts = full_name.split()
            if parts:
                first_name = parts[0]
                last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

        # إنشاء User مع tenant_id مباشرة حتى يعمل Signal بشكل صحيح
        user = UserModel.objects.create_user(
            username=username,
            email=email,
            password=password,
            tenant_id=tenant_id,  # ✅ تعيين tenant_id عند الإنشاء
            first_name=first_name,
            last_name=last_name,
            full_name=full_name or f"{first_name} {last_name}".strip(),
            phone_number=phone_number or '',
            country_code=country_code or '',
            currency=currency.code,
            preferred_currency_code=currency.code,
            role=getattr(UserModel.Roles, 'END_USER', 'end_user') if hasattr(UserModel, 'Roles') else 'end_user',
        )

        return Response(
            {
                'id': str(user.id),
                'email': user.email,
                'fullName': user.full_name,
                'username': user.username,
                'currencyCode': currency.code,
            },
            status=status.HTTP_201_CREATED,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_user_document(request):
    """رفع وثيقة (صورة) للمستخدم - حد أقصى 3 وثائق"""
    from django.core.files.storage import default_storage
    import os
    
    tenant_raw = _resolve_tenant_id(request)
    if not tenant_raw:
        raise ValidationError('TENANT_ID_REQUIRED')
    tenant_id = _require_tenant_uuid(tenant_raw)
    
    user_id = request.data.get('userId')
    if not user_id:
        return Response({'error': 'userId مطلوب'}, status=status.HTTP_400_BAD_REQUEST)
    
    user = _get_user_for_tenant_or_404(user_id, tenant_id)
    
    # التحقق من عدد الوثائق الحالية
    current_docs = user.documents or []
    if len(current_docs) >= 3:
        return Response({'error': 'الحد الأقصى 3 وثائق'}, status=status.HTTP_400_BAD_REQUEST)
    
    # الحصول على الملف
    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return Response({'error': 'ملف مطلوب'}, status=status.HTTP_400_BAD_REQUEST)
    
    # التحقق من نوع الملف (صور فقط)
    allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    file_ext = uploaded_file.name.split('.')[-1].lower()
    if file_ext not in allowed_extensions:
        return Response({'error': 'نوع الملف غير مدعوم. الرجاء رفع صورة'}, status=status.HTTP_400_BAD_REQUEST)
    
    # حفظ الملف
    file_name = f"user_{user.id}_{uuid.uuid4()}.{file_ext}"
    file_path = f"documents/users/{file_name}"
    
    saved_path = default_storage.save(file_path, uploaded_file)
    file_url = default_storage.url(saved_path)
    
    # إضافة الرابط للوثائق
    current_docs.append(file_url)
    user.documents = current_docs
    user.save(update_fields=['documents'])
    
    return Response({
        'url': file_url,
        'documents': user.documents
    }, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_user_document(request, user_id: str):
    """حذف وثيقة من وثائق المستخدم"""
    tenant_raw = _resolve_tenant_id(request)
    if not tenant_raw:
        raise ValidationError('TENANT_ID_REQUIRED')
    tenant_id = _require_tenant_uuid(tenant_raw)
    
    user = _get_user_for_tenant_or_404(user_id, tenant_id)
    
    document_url = request.data.get('documentUrl')
    if not document_url:
        return Response({'error': 'documentUrl مطلوب'}, status=status.HTTP_400_BAD_REQUEST)
    
    current_docs = user.documents or []
    if document_url in current_docs:
        current_docs.remove(document_url)
        user.documents = current_docs
        user.save(update_fields=['documents'])
        
        # حذف الملف من التخزين
        try:
            from django.core.files.storage import default_storage
            # استخراج المسار من URL
            if '/media/' in document_url:
                file_path = document_url.split('/media/')[-1]
                default_storage.delete(file_path)
        except Exception as e:
            logger.warning(f'فشل حذف الملف: {str(e)}')
    
    return Response({
        'documents': user.documents
    }, status=status.HTTP_200_OK)
