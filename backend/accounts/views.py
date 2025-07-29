from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .authentication import APITokenAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication  # ✅
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAdminUser
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import Currency
from .serializers import CurrencySerializer

from .serializers import (
    MyTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()

# ✅ تسجيل مستخدم جديد
class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                "message": "تم إنشاء المستخدم بنجاح",
                "token": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh)
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ✅ عرض بيانات المستخدم المسجل الدخول مع التوكن
@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAuthenticated])
def profile_view(request):
    user = request.user
    return Response({
        'id': user.id,
        'email': user.email,
        'balance': str(user.balance),
        'price_group_id': user.price_group.id if user.price_group else None,
        'price_group_name': user.price_group.name if user.price_group else None,
        'api_token': user.api_token,
    })

# ✅ عرض رصيد المستخدم فقط
@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_balance(request):
    return Response({'balance': request.user.balance})

# ✅ عرض بيانات المستخدم بناء على التوكن
@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAuthenticated])
def profile_by_token(request):
    user = request.user
    return Response({
        'id': user.id,
        'email': user.email,
        'balance': str(user.balance),
        'price_group_id': user.price_group.id if user.price_group else None,
        'price_group_name': user.price_group.name if user.price_group else None,
        'api_token': user.api_token,
        'is_staff': user.is_staff,            # إضافة هنا
        'is_superuser': user.is_superuser,    # إضافة هنا
        'currency': {
            'id': user.currency.id,
            'name': user.currency.name,
            'symbol': user.currency.symbol,
            'rate_to_usd': user.currency.rate_to_usd,
        } if user.currency else None,
    })



# ✅ عرض المستخدمين (للمشرف)
@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAuthenticated])
def list_users(request):
    users = User.objects.all().order_by('-date_joined')
    data = [
        {
            'id': u.id,
            'email': u.email,
            'balance': str(u.balance),
            'date_joined': u.date_joined,
        }
        for u in users
    ]
    return Response(data)

# ✅ تحديث رصيد مستخدم
@api_view(['POST'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAuthenticated])
def update_user_balance(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'المستخدم غير موجود'}, status=404)

    new_balance = request.data.get('balance')
    try:
        user.balance = float(new_balance)
        user.save()
        return Response({'message': 'تم تحديث الرصيد بنجاح'})
    except:
        return Response({'error': 'رصيد غير صالح'}, status=400)

# ✅ JWT تسجيل الدخول
class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


# ✅ للتجربة
@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAuthenticated])
def test_token(request):
    return Response({
        "message": "تم الوصول بنجاح",
        "user": request.user.email,
    })

@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAuthenticated])
def whoami(request):
    user = request.user
    return Response({
        'email': user.email,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
    })

@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def currency_list(request):
    currencies = Currency.objects.filter(is_active=True)
    serializer = CurrencySerializer(currencies, many=True)
    return Response(serializer.data)

@api_view(['PUT'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def update_currency(request, pk):
    try:
        currency = Currency.objects.get(pk=pk)
    except Currency.DoesNotExist:
        return Response({'error': 'العملة غير موجودة'}, status=404)

    serializer = CurrencySerializer(currency, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)