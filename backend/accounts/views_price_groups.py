from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework import status
from .models import PriceGroup, CustomUser
from .serializers_price_groups import PriceGroupSerializer
from store.models import ProductPackage, PackagePrice

# الصلاحيات والتوثيق
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.authentication import SessionAuthentication
from .authentication import APITokenAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication


# ✅ عرض وإنشاء مجموعات الأسعار (للمشرف فقط)
@api_view(['GET', 'POST'])
@authentication_classes([APITokenAuthentication, SessionAuthentication])
@permission_classes([IsAdminUser])
def price_group_list_create(request):
    if request.method == 'GET':
        groups = PriceGroup.objects.all().order_by('-id')
        serializer = PriceGroupSerializer(groups, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = PriceGroupSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ✅ تفاصيل مجموعة السعر (للمشرف فقط)
@api_view(['GET', 'PUT', 'DELETE'])
@authentication_classes([APITokenAuthentication, SessionAuthentication])
@permission_classes([IsAdminUser])
def price_group_detail(request, pk):
    try:
        group = PriceGroup.objects.get(pk=pk)
    except PriceGroup.DoesNotExist:
        return Response({'error': 'المجموعة غير موجودة'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = PriceGroupSerializer(group)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = PriceGroupSerializer(group, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        group.delete()
        return Response({'message': 'تم الحذف بنجاح'}, status=status.HTTP_204_NO_CONTENT)

# ✅ عرض جميع الباقات مع الأسعار حسب المجموعات (للمشرف فقط)
@api_view(['GET'])
@authentication_classes([APITokenAuthentication, SessionAuthentication])
@permission_classes([IsAdminUser])
def all_packages_with_prices(request):
    all_groups = PriceGroup.objects.all()
    result = []

    for package in ProductPackage.objects.filter(is_active=True):
        price_groups = []
        for group in all_groups:
            obj, _ = PackagePrice.objects.get_or_create(
                package=package,
                group=group,
                defaults={'price': 0}
            )
            price_groups.append({
                'group_id': group.id,
                'group_name': group.name,
                'price': str(obj.price),
            })

        result.append({
            'id': package.id,
            'product_title': package.product.title,
            'name': package.name,
            'base_price': str(package.base_price),
            'price_groups': price_groups,
        })

    return Response(result)

# ✅ عرض المستخدمين وربطهم بالمجموعات (للمشرف فقط)
@api_view(['GET'])
@authentication_classes([APITokenAuthentication, JWTAuthentication, SessionAuthentication])
@permission_classes([IsAdminUser])
def admin_list_users(request):
    users = CustomUser.objects.all()
    data = []

    for user in users:
        data.append({
            'id': user.id,
            'email': user.email,
            'price_group_id': user.price_group.id if user.price_group else None,
            'price_group_name': user.price_group.name if user.price_group else None,
        })

    return Response(data)

@api_view(['POST'])
@authentication_classes([APITokenAuthentication, SessionAuthentication])
@permission_classes([IsAdminUser])
def set_user_price_group(request):
    user_id = request.data.get('user_id')
    group_id = request.data.get('group_id')

    try:
        user = CustomUser.objects.get(id=user_id)
        group = PriceGroup.objects.get(id=group_id)
        user.price_group = group
        user.save()

        return Response({
            'message': f"✅ تم ربط {user.email} بالمجموعة {group.name}",
            'user_id': user.id,
            'price_group_id': group.id,
            'price_group_name': group.name,
        })

    except CustomUser.DoesNotExist:
        return Response({'error': 'المستخدم غير موجود'}, status=status.HTTP_404_NOT_FOUND)
    except PriceGroup.DoesNotExist:
        return Response({'error': 'المجموعة غير موجودة'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

# ✅ اختبار صلاحيات المستخدم (عام لجميع المسجلين)
@api_view(['GET'])
@authentication_classes([APITokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def test_user_info(request):
    user = request.user
    return Response({
        "email": user.email,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser
    })
