import uuid
import secrets
from datetime import datetime, timedelta, timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError, NotFound
from django.db.models import Q
from django.contrib.auth import authenticate, get_user_model
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from django.conf import settings
import jwt
from rest_framework_simplejwt.tokens import RefreshToken
from argon2.low_level import hash_secret, verify_secret, Type
import bcrypt
from .serializers import (
    UserProfileSerializer, UserProfileWithCurrencySerializer,
    LegacyUserListSerializer, LegacyUserWithPriceGroupSerializer,
)
from .legacy_models import LegacyUser
from apps.products.views import _resolve_tenant_id
from apps.currencies.models import Currency


def _argon2_hash(password: str) -> str:
    if not isinstance(password, str) or not password:
        raise ValidationError('PASSWORD_INVALID')
    salt = secrets.token_bytes(16)
    hashed = hash_secret(
        password.encode('utf-8'),
        salt,
        time_cost=3,
        memory_cost=4096,
        parallelism=1,
        hash_len=32,
        type=Type.ID,
    )
    return hashed.decode('utf-8')


def _verify_password(password: str, hashed: str) -> bool:
    if not password or not hashed:
        return False
    try:
        if hashed.startswith('$argon2'):
            return bool(
                verify_secret(
                    hashed.encode('utf-8'),
                    password.encode('utf-8'),
                    type=Type.ID,
                )
            )
        if hashed.startswith('$2'):  # bcrypt legacy hashes
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False
    return False


def _issue_legacy_token(user: LegacyUser, minutes: int = 60) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=minutes)
    payload = {
        'sub': str(user.id),
        'email': user.email,
        'role': (user.role or 'user').lower(),
        'tenantId': str(user.tenant_id) if user.tenant_id else None,
        'iat': int(now.timestamp()),
        'exp': int(exp.timestamp()),
        'legacy': True,
        'totpVerified': True,
        'tokenVersion': 1,
    }
    # Remove None values to keep payload compact
    payload = {k: v for k, v in payload.items() if v is not None}
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
    # PyJWT >= 2 returns str, older versions bytes
    return token if isinstance(token, str) else token.decode('utf-8')


def _legacy_user_payload(user: LegacyUser) -> dict:
    return {
        'id': str(user.id),
        'email': user.email,
        'username': user.username,
        'role': (user.role or 'user').lower(),
        'tenantId': str(user.tenant_id) if user.tenant_id else None,
        'fullName': user.full_name,
        'phoneNumber': user.phone_number,
        'countryCode': user.country_code,
    }


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
    if isinstance(user, LegacyUser):
        if request.method == "PUT":
            return Response({'message': 'لا يمكن تعديل الملف من هذه الواجهة حالياً'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
        currency_code = user.preferred_currency_code or 'USD'
        price_group_id = getattr(user, 'price_group_id', None)
        data = {
            'id': str(user.id),
            'username': user.username,
            'email': user.email,
            'first_name': (user.full_name or '').split(' ', 1)[0] if user.full_name else '',
            'last_name': (user.full_name or '').split(' ', 1)[1] if user.full_name and ' ' in user.full_name else '',
            'balance': float(user.balance or 0),
            'currency': currency_code,
            'currencyCode': currency_code,
            'currency_code': currency_code,
            'status': 'active' if user.is_active else 'disabled',
            'overdraft': float(user.overdraft_limit or 0),
            'role': (user.role or 'user').lower(),
            'priceGroupId': str(price_group_id) if price_group_id else None,
            'price_group_id': str(price_group_id) if price_group_id else None,
            'priceGroup': {'id': str(price_group_id)} if price_group_id else None,
        }
        return Response(data)
    if request.method == "PUT":
        # Allow updating first_name/last_name only for now to avoid schema drift
        data = {k: v for k, v in request.data.items() if k in ["first_name", "last_name"]}
        serializer = UserProfileSerializer(user, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(UserProfileSerializer(user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile_with_currency(request):
    user = request.user
    if isinstance(user, LegacyUser):
        currency_code = user.preferred_currency_code or 'USD'
        price_group_id = getattr(user, 'price_group_id', None)
        data = {
            'id': str(user.id),
            'username': user.username,
            'email': user.email,
            'first_name': (user.full_name or '').split(' ', 1)[0] if user.full_name else '',
            'last_name': (user.full_name or '').split(' ', 1)[1] if user.full_name and ' ' in user.full_name else '',
            'balance': float(user.balance or 0),
            'currency': currency_code,
            'currencyCode': currency_code,
            'currency_code': currency_code,
            'status': 'active' if user.is_active else 'disabled',
            'overdraft': float(user.overdraft_limit or 0),
            'role': (user.role or 'user').lower(),
            'priceGroupId': str(price_group_id) if price_group_id else None,
            'price_group_id': str(price_group_id) if price_group_id else None,
            'priceGroup': {'id': str(price_group_id)} if price_group_id else None,
        }
        return Response(data)
    data = UserProfileWithCurrencySerializer(user).data
    currency_code = data.get('currency_code') or data.get('currency')
    if currency_code:
        data['currencyCode'] = currency_code
    price_group_id = getattr(user, 'price_group_id', None)
    data['priceGroupId'] = str(price_group_id) if price_group_id else None
    data['price_group_id'] = str(price_group_id) if price_group_id else None
    data['priceGroup'] = {'id': str(price_group_id)} if price_group_id else None
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_users(request):
    tenant_id = _resolve_tenant_id(request)
    if not tenant_id:
        raise ValidationError('TENANT_ID_REQUIRED')
    qs = LegacyUser.objects.filter(tenant_id=tenant_id)
    # optional search by q
    q = (request.query_params.get('q') or '').strip()
    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q))
    # exclude soft system roles similar to UI filters? leaving raw list for now
    return Response(LegacyUserListSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def users_with_price_group(request):
    tenant_id = _resolve_tenant_id(request)
    if not tenant_id:
        raise ValidationError('TENANT_ID_REQUIRED')
    qs = LegacyUser.objects.filter(tenant_id=tenant_id)
    return Response(LegacyUserWithPriceGroupSerializer(qs, many=True).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def set_user_price_group(request, id: str):
    tenant_id = _resolve_tenant_id(request)
    if not tenant_id:
        raise ValidationError('TENANT_ID_REQUIRED')
    try:
        user = LegacyUser.objects.get(id=id, tenant_id=tenant_id)
    except LegacyUser.DoesNotExist:
        raise NotFound('المستخدم غير موجود')
    price_group_id = request.data.get('priceGroupId', None)
    if price_group_id in ('', None):
        user.price_group_id = None
    else:
        # Accept UUID only
        s = str(price_group_id)
        if len(s) != 36:
            raise ValidationError('priceGroupId غير صالح')
        user.price_group_id = s
    user.save(update_fields=['price_group_id'])
    return Response({ 'ok': True })


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

        legacy_user = None
        if tenant_id:
            base_qs = LegacyUser.objects.filter(tenant_id=tenant_id)
            if '@' in str(identifier):
                legacy_user = base_qs.filter(email__iexact=identifier).first()
            if not legacy_user:
                legacy_user = base_qs.filter(username__iexact=identifier).first()

        if legacy_user:
            if not _verify_password(password, legacy_user.password):
                return Response({'message': 'بيانات الاعتماد غير صحيحة'}, status=status.HTTP_401_UNAUTHORIZED)
            token = _issue_legacy_token(legacy_user)
            body = {
                'token': token,
                'access': token,
                'access_token': token,
                'refresh': None,
                'user': _legacy_user_payload(legacy_user),
                'requiresTotp': False,
                'totpPending': False,
            }
            response = Response(body)
            _set_auth_cookies(response, token, request)
            return response

        # Try authenticate by username first; if identifier contains @, try email lookup
        user = None
        User = get_user_model()
        # Direct username attempt
        user = authenticate(request, username=identifier, password=password)
        if user is None and '@' in str(identifier):
            try:
                u = User.objects.get(email__iexact=identifier)
                user = authenticate(request, username=u.username, password=password)
            except User.DoesNotExist:
                user = None
        if user is None:
            return Response({ 'message': 'بيانات الاعتماد غير صحيحة' }, status=status.HTTP_401_UNAUTHORIZED)

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
        }
        response = Response(body)
        _set_auth_cookies(response, access, request)
        return response


class RegisterContextView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')

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
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            tenant_id = uuid.UUID(str(tenant_raw))
        except (ValueError, TypeError):
            raise ValidationError('TENANT_ID_INVALID')

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

        if LegacyUser.objects.filter(tenant_id=tenant_id, email__iexact=email).exists():
            return Response({'message': 'البريد الإلكتروني مستخدم مسبقًا'}, status=status.HTTP_409_CONFLICT)

        if LegacyUser.objects.filter(tenant_id=tenant_id, username__iexact=username).exists():
            return Response({'message': 'اسم المستخدم مستخدم مسبقًا'}, status=status.HTTP_409_CONFLICT)

        hashed_password = _argon2_hash(password)

        legacy_user = LegacyUser.objects.create(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            email=email,
            password=hashed_password,
            username=username,
            full_name=full_name or None,
            phone_number=phone_number,
            country_code=country_code,
            currency_id=currency.id,
            preferred_currency_code=currency.code,
            role='user',
            is_active=True,
        )

        return Response(
            {
                'id': str(legacy_user.id),
                'email': legacy_user.email,
                'fullName': legacy_user.full_name,
                'username': legacy_user.username,
            },
            status=status.HTTP_201_CREATED,
        )
