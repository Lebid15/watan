from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError, NotFound
from django.db.models import Q
from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import (
    UserProfileSerializer, UserProfileWithCurrencySerializer,
    LegacyUserListSerializer, LegacyUserWithPriceGroupSerializer,
)
from .legacy_models import LegacyUser
from apps.products.views import _resolve_tenant_id


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def profile(request):
    user = request.user
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
    return Response(UserProfileWithCurrencySerializer(user).data)


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
        return Response(body)
