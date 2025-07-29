from rest_framework.decorators import api_view, permission_classes, parser_classes, authentication_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from decimal import Decimal
from rest_framework_simplejwt.authentication import JWTAuthentication
from accounts.authentication import APITokenAuthentication

from .models import Product, ProductPackage, ProductOrder, PackagePrice
from .serializers import ProductSerializer, ProductOrderSerializer, ProductCreateSerializer, ProductPackageAdminSerializer
from accounts.models import PriceGroup, CustomUser


from decimal import Decimal

@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def list_all_orders(request):
    orders = ProductOrder.objects.select_related('user', 'package').order_by('-created_at')
    data = []

    for o in orders:
        user_group = o.user.price_group
        price = None
        if user_group:
            price_obj = PackagePrice.objects.filter(package=o.package, group=user_group).first()
            if price_obj:
                price = price_obj.price

        # استخرج سعر الصرف ورمز العملة من عملة المستخدم
        user_currency = o.user.currency
        if user_currency and price is not None:
            converted_price = Decimal(price) * Decimal(user_currency.rate_to_usd)
            converted_price_str = f"{converted_price:.2f}"
            currency_symbol = user_currency.symbol
        else:
            converted_price_str = str(price) if price is not None else '—'
            currency_symbol = ''

        data.append({
            'id': o.id,
            'user_email': o.user.email,
            'package_name': o.package.name,
            'package_price': converted_price_str,
            'currency_symbol': currency_symbol,
            'status': o.status,
            'created_at': o.created_at,
        })

    return Response(data)




from decimal import Decimal

@api_view(['POST'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def review_order(request, order_id):
    try:
        order = ProductOrder.objects.get(id=order_id)
    except ProductOrder.DoesNotExist:
        return Response({'error': 'الطلب غير موجود'}, status=404)

    new_status = request.data.get('status')
    if new_status not in ['approved', 'rejected']:
        return Response({'error': 'الحالة غير صالحة'}, status=400)

    if order.status != 'rejected' and new_status == 'rejected':
        user = order.user
        package = order.package
        price_to_return = package.base_price
        user_currency_rate = Decimal('1.0')
        if user.currency:
            user_currency_rate = Decimal(user.currency.rate_to_usd)

        if user.price_group:
            try:
                custom_price = PackagePrice.objects.get(package=package, group=user.price_group)
                price_to_return = custom_price.price
            except PackagePrice.DoesNotExist:
                pass

        # تحويل السعر حسب سعر الصرف قبل إرجاع الرصيد
        price_to_return = Decimal(price_to_return) * user_currency_rate

        user.balance += price_to_return
        user.save()

    order.status = new_status
    order.save()
    return Response({'message': 'تم تحديث حالة الطلب.'})



@api_view(['POST'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def create_product_with_packages(request):
    serializer = ProductCreateSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'تم إنشاء المنتج بنجاح'}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def product_detail_by_id(request, id):
    try:
        product = Product.objects.get(id=id)
    except Product.DoesNotExist:
        return Response({'error': 'المنتج غير موجود'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ProductSerializer(product)
    return Response(serializer.data)


@api_view(['POST'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def add_package_to_product(request, product_id):
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return Response({'error': 'المنتج غير موجود'}, status=404)

    name = request.data.get('name')
    price = request.data.get('price')
    description = request.data.get('description', '')

    if not name or not price:
        return Response({'error': 'الاسم والسعر مطلوبان'}, status=400)

    try:
        price = Decimal(price)
    except:
        return Response({'error': 'السعر غير صالح'}, status=400)

    package = ProductPackage.objects.create(
        product=product,
        name=name,
        base_price=price,
        description=description
    )

    return Response({'message': '✅ تم إضافة الباقة', 'package_id': package.id})


@api_view(['DELETE'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def delete_package(request, package_id):
    try:
        package = ProductPackage.objects.get(id=package_id)
    except ProductPackage.DoesNotExist:
        return Response({'error': 'الباقة غير موجودة'}, status=404)

    package.delete()
    return Response({'message': '🗑️ تم حذف الباقة'})


@api_view(['PUT'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def update_package(request, package_id):
    try:
        package = ProductPackage.objects.get(id=package_id)
    except ProductPackage.DoesNotExist:
        return Response({'error': 'الباقة غير موجودة'}, status=404)

    name = request.data.get('name')
    base_price = request.data.get('base_price')
    description = request.data.get('description', '')

    if base_price:
        try:
            package.base_price = Decimal(base_price)
        except:
            return Response({'error': 'رأس المال غير صالح'}, status=400)

    if name:
        package.name = name
    if description:
        package.description = description

    package.save()
    return Response({'message': '✏️ تم تحديث الباقة بنجاح'})


@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def list_package_prices(request):
    packages = ProductPackage.objects.select_related('product').all()
    serializer = ProductPackageAdminSerializer(packages, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def all_packages_with_prices(request):
    packages = ProductPackage.objects.select_related('product').all()
    groups = PriceGroup.objects.all()

    data = []
    for pkg in packages:
        pkg_data = {
            'id': pkg.id,
            'name': pkg.name,
            'product_title': pkg.product.title,
            'base_price': str(pkg.base_price),
            'price_groups': [],
        }

        for group in groups:
            price_obj = PackagePrice.objects.filter(package=pkg, group=group).first()
            pkg_data['price_groups'].append({
                'group_id': group.id,
                'group_name': group.name,
                'price': str(price_obj.price) if price_obj else "",
            })

        data.append(pkg_data)

    return Response(data)


@api_view(['POST'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def update_package_price(request):
    package_id = request.data.get('package_id')
    group_id = request.data.get('group_id')
    price = request.data.get('price')

    try:
        package = ProductPackage.objects.get(id=package_id)
        group = PriceGroup.objects.get(id=group_id)
    except (ProductPackage.DoesNotExist, PriceGroup.DoesNotExist):
        return Response({'error': 'الباقة أو المجموعة غير موجودة'}, status=404)

    price_obj, _ = PackagePrice.objects.get_or_create(package=package, group=group)
    price_obj.price = price
    price_obj.save()

    return Response({'message': 'تم التحديث بنجاح'})


@api_view(['POST'])
@authentication_classes([APITokenAuthentication, JWTAuthentication])
@permission_classes([IsAdminUser])
def set_user_price_group(request):
    user_id = request.data.get('user_id')
    group_id = request.data.get('group_id')

    if not user_id:
        return Response({'error': 'user_id مفقود'}, status=400)

    try:
        user = CustomUser.objects.get(id=user_id)
    except CustomUser.DoesNotExist:
        return Response({'error': 'المستخدم غير موجود'}, status=404)

    if group_id:
        try:
            group = PriceGroup.objects.get(id=group_id)
            user.price_group = group
        except PriceGroup.DoesNotExist:
            return Response({'error': 'المجموعة غير موجودة'}, status=404)
    else:
        user.price_group = None

    user.save()
    return Response({'message': '✅ تم تحديث مجموعة المستخدم'})
