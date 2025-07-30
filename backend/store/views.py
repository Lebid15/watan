from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from .models import Product, ProductOrder, ProductPackage
from .serializers import ProductSerializer, ProductOrderSerializer
from rest_framework.permissions import IsAuthenticated
from store.models import PackagePrice

from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from accounts.authentication import APITokenAuthentication
from rest_framework.decorators import authentication_classes
from decimal import Decimal

# عرض المنتجات
# @api_view(['GET'])
# def product_list(request):
#     products = Product.objects.filter(is_active=True).order_by('-id')
#     serializer = ProductSerializer(products, many=True)
#     return Response(serializer.data)

@api_view(['GET'])
@authentication_classes([APITokenAuthentication])
@permission_classes([IsAuthenticated])
def product_list(request):
    products = Product.objects.filter(is_active=True).order_by('-id')
    serializer = ProductSerializer(products, many=True)
    return Response(serializer.data)

# تفاصيل منتج
@api_view(['GET'])
def product_detail(request, slug):
    try:
        product = Product.objects.get(slug=slug)
    except Product.DoesNotExist:
        return Response({'error': 'المنتج غير موجود'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ProductSerializer(product)
    return Response(serializer.data)


@api_view(['POST'])
@authentication_classes([APITokenAuthentication, JWTAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def create_order(request):
    package_id = request.data.get('package_id')
    if not package_id:
        return Response({'error': 'رقم الباقة مطلوب'}, status=400)

    try:
        package = ProductPackage.objects.get(id=package_id, is_active=True)
    except ProductPackage.DoesNotExist:
        return Response({'error': 'الباقة غير موجودة'}, status=404)

    user = request.user
    group = user.price_group

    # تحديد السعر بناءً على المجموعة أو رأس المال
    final_price = package.base_price
    if group:
        try:
            price_obj = PackagePrice.objects.get(package=package, group=group)
            final_price = price_obj.price
        except PackagePrice.DoesNotExist:
            pass

    # تحويل السعر حسب عملة المستخدم (العملة مرتبطة بالمستخدم)
    user_currency_rate = Decimal(user.currency.rate_to_usd) if user.currency else Decimal(1)
    price_to_deduct = final_price * user_currency_rate

    # التحقق من الرصيد
    if user.balance < price_to_deduct:
        return Response({'error': 'الرصيد غير كافٍ'}, status=400)

    # خصم الرصيد وإنشاء الطلب
    user.balance -= price_to_deduct
    user.save()

    order = ProductOrder.objects.create(user=user, package=package)
    serializer = ProductOrderSerializer(order)

    return Response(serializer.data, status=201)


@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def my_orders(request):
    orders = ProductOrder.objects.filter(user=request.user).select_related('package').order_by('-created_at')
    data = []

    for o in orders:
        user_group = request.user.price_group
        if user_group:
            price_obj = o.package.prices.filter(group=user_group).first()
            price = price_obj.price if price_obj else None
        else:
            price = None

        # تحويل السعر حسب العملة
        user_currency_rate = request.user.currency.rate_to_usd if request.user.currency else 1
        user_currency_symbol = request.user.currency.symbol if request.user.currency else "$"

        if price is not None:
            converted_price = float(price) * float(user_currency_rate)
        else:
            converted_price = "غير محددة"

        data.append({
            'id': o.id,
            'status': o.status,
            'created_at': o.created_at,
            'package_name': o.package.name,
            'package_price': f"{converted_price:.2f}" if isinstance(converted_price, float) else converted_price,
            'currency_symbol': user_currency_symbol,
        })

    return Response(data)

