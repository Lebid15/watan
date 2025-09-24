from __future__ import annotations

from django.db.models import Prefetch
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, ValidationError
from django.db import IntegrityError
from django.db.models import Count
from .models import Product, ProductPackage, PackagePrice, PriceGroup
from .serializers import ProductListSerializer, ProductDetailSerializer, PriceGroupSerializer
import uuid


def _resolve_tenant_id(request) -> str | None:
    # Prefer middleware-annotated tenant
    tid = getattr(request, 'tenant', None)
    if tid and getattr(tid, 'id', None):
        return str(tid.id)
    user = getattr(request, 'user', None)
    if user and getattr(user, 'tenant_id', None):
        return str(user.tenant_id)
    return None


class ProductsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        include_all = str(request.query_params.get('all') or '').lower() in ('1','true') or \
                      str(request.query_params.get('includeNull') or '').lower() in ('1','true')
        if not tenant_id:
            # mirror Nest dev-fallback: only global container
            GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
            products = (
                Product.objects
                .filter(tenant_id=GLOBAL_ID)
                .prefetch_related('packages')
                .order_by('name')[:500]
            )
            # no prices in global listing
            ser = ProductListSerializer(products, many=True)
            data = ser.data
            # attach basePrice mapping
            for p in data:
                for pk in p.get('packages', []):
                    pk['prices'] = []
            return Response(data)

        # tenant-scoped listing, include price groups matrix
        groups = list(PriceGroup.objects.filter(tenant_id=tenant_id))
        # prefetch related prices to avoid N+1
        pk_qs = ProductPackage.objects.filter().prefetch_related(
            Prefetch(
                'prices',
                queryset=PackagePrice.objects.select_related('price_group').filter(tenant_id=tenant_id),
                to_attr='_price_rows',
            )
        )
        products = (
            Product.objects
            .filter(tenant_id=tenant_id)
            .prefetch_related(Prefetch('packages', queryset=pk_qs))
        )
        # Filter visible packages similar to Nest getTenantVisibleProducts if all not requested
        items = []
        for prod in products:
            pkgs = list(getattr(prod, 'packages', []))
            if not include_all:
                pkgs = [p for p in pkgs if p.public_code is not None and p.is_active]
            # sort: unit first then by publicCode then name
            pkgs.sort(key=lambda p: (
                0 if getattr(p, 'type', None) == 'unit' else 1,
                getattr(p, 'public_code', 9999999) if getattr(p, 'public_code', None) is not None else 9999999,
                (p.name or ''),
            ))
            prod.packages = pkgs  # attach filtered/sorted
            items.append(prod)
        ser = ProductListSerializer(items, many=True, context={'all_price_groups': groups})
        return Response(ser.data)


class ProductDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise NotFound('tenantId مفقود')
        groups = list(PriceGroup.objects.filter(tenant_id=tenant_id))
        pk_qs = ProductPackage.objects.filter().prefetch_related(
            Prefetch(
                'prices',
                queryset=PackagePrice.objects.select_related('price_group').filter(tenant_id=tenant_id),
                to_attr='_price_rows',
            )
        )
        try:
            product = (
                Product.objects
                .filter(tenant_id=tenant_id, id=id)
                .prefetch_related(Prefetch('packages', queryset=pk_qs))
            ).get()
        except Product.DoesNotExist:
            raise NotFound('لم يتم العثور على المنتج')
        # Filter/sort packages like list endpoint
        pkgs = list(getattr(product, 'packages', []))
        pkgs = [p for p in pkgs if p.public_code is not None and p.is_active]
        pkgs.sort(key=lambda p: (
            0 if getattr(p, 'type', None) == 'unit' else 1,
            getattr(p, 'public_code', 9999999) if getattr(p, 'public_code', None) is not None else 9999999,
            (p.name or ''),
        ))
        product.packages = pkgs
        ser = ProductDetailSerializer(product, context={'all_price_groups': groups})
        return Response(ser.data)


class PriceGroupsListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            return Response([])
        groups = PriceGroup.objects.filter(tenant_id=tenant_id).order_by('name')
        return Response(PriceGroupSerializer(groups, many=True).data)

    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        name = (request.data.get('name') or '').strip()
        if not name:
            raise ValidationError('اسم المجموعة مطلوب')
        # Attempt insert via unmanaged model using raw SQL to let DB generate uuid if exists as default.
        # But our unmanaged model expects providing id; we'll let DB default handle if sequence exists.
        grp = PriceGroup(id=uuid.UUID(str(uuid.uuid4())), tenant_id=tenant_id, name=name, is_active=True)
        # Using save() with managed=False works for insert
        try:
            grp.save(using='default', force_insert=True)
        except IntegrityError:
            raise ValidationError('اسم المجموعة موجود بالفعل')
        return Response(PriceGroupSerializer(grp).data, status=201)


class PriceGroupDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        try:
            grp = PriceGroup.objects.get(id=id, tenant_id=tenant_id)
        except PriceGroup.DoesNotExist:
            raise NotFound('المجموعة غير موجودة')
        name = request.data.get('name')
        is_active = request.data.get('is_active')
        if name is not None:
            name = str(name).strip()
            if not name:
                raise ValidationError('اسم المجموعة مطلوب')
            grp.name = name
        if is_active is not None:
            val = str(is_active).lower()
            grp.is_active = val in ('1', 'true', 't', 'yes', 'y') or is_active is True
        try:
            grp.save(update_fields=['name', 'is_active'])
        except IntegrityError:
            raise ValidationError('اسم المجموعة موجود بالفعل')
        return Response(PriceGroupSerializer(grp).data)

    def delete(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        try:
            grp = PriceGroup.objects.get(id=id, tenant_id=tenant_id)
        except PriceGroup.DoesNotExist:
            raise NotFound('المجموعة غير موجودة')
        grp.delete()
        return Response({ 'message': 'تم حذف المجموعة بنجاح' })


class UsersPriceGroupsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            return Response([])
        # We don't have a Users Django model connected to Nest users table here.
        # As a pragmatic step, return groups with a usersCount=0 to satisfy UI; can be enhanced later.
        groups = PriceGroup.objects.filter(tenant_id=tenant_id).order_by('name')
        data = PriceGroupSerializer(groups, many=True).data
        # annotate usersCount as 0 placeholder
        for item in data:
            item['users'] = []
        return Response(data)
