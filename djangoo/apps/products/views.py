from __future__ import annotations

from django.db.models import Prefetch, Q
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count
from .models import Product, ProductPackage, PackagePrice, PriceGroup
from .serializers import ProductListSerializer, ProductDetailSerializer, PriceGroupSerializer
import uuid
import re
from decimal import Decimal, InvalidOperation
from apps.users.permissions import RequireAdminRole
from apps.users.legacy_models import LegacyUser


def _resolve_tenant_id(request) -> str | None:
    """Resolve tenant UUID consistently with legacy behavior.
    Order:
      1) request.tenant.id (set by TenantHostMiddleware)
      2) X-Tenant-Host header -> TenantDomain lookup
      3) request.user.tenant_id (if present on user model)
    """
    # 1) Middleware annotation
    tid = getattr(request, 'tenant', None)
    if tid and getattr(tid, 'id', None):
        val = str(tid.id)
        # Accept only UUID-like values (avoid accidental integer ids from local dj_tenants)
        if re.fullmatch(r"[0-9a-fA-F-]{36}", val):
            return val
    # 2) Header-based resolve (parity with legacy NestJS)
    host_header = request.META.get(getattr(settings, 'TENANT_HEADER', 'HTTP_X_TENANT_HOST')) or request.META.get('HTTP_HOST')
    if host_header:
        host = str(host_header).split(':')[0]
        try:
            from apps.tenants.models import TenantDomain  # type: ignore
            dom = TenantDomain.objects.filter(domain=host).order_by('-is_primary').first()
            if dom and getattr(dom, 'tenant_id', None):
                return str(dom.tenant_id)
        except Exception:
            pass
    # 3) Optional: user-bound tenant
    user = getattr(request, 'user', None)
    if user and getattr(user, 'tenant_id', None):
        return str(user.tenant_id)
    return None


class ProductsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        include_all = str(request.query_params.get('all') or '').lower() in ('1','true') or \
                      str(request.query_params.get('includeNull') or '').lower() in ('1','true')
        if not tenant_id:
            # Strict behavior: require tenant for /products list; do NOT leak global here
            # Frontend has a dedicated /products/global endpoint for catalog
            return Response([])
        # Never serve global catalog via tenant endpoint
        if str(tenant_id) == GLOBAL_ID:
            return Response([])

        # tenant-scoped listing, include price groups matrix
        groups = list(PriceGroup.objects.filter(tenant_id=tenant_id))
        # prefetch related prices to avoid N+1 — be defensive against unmanaged FK quirks
        try:
            pk_qs = ProductPackage.objects.filter(tenant_id=tenant_id).prefetch_related(
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
        except Exception:
            # Fallback: prefetch only packages without prices mapping
            pk_qs = ProductPackage.objects.filter(tenant_id=tenant_id)
            products = (
                Product.objects
                .filter(tenant_id=tenant_id)
                .prefetch_related(Prefetch('packages', queryset=pk_qs))
            )
        # Filter visible packages similar to Nest getTenantVisibleProducts if all not requested
        items = []
        for prod in products:
            pkgs_rel = getattr(prod, 'packages', None)
            if hasattr(pkgs_rel, 'all'):
                pkgs = list(pkgs_rel.all())
            else:
                pkgs = list(pkgs_rel or [])
            # Hard isolation: keep only packages belonging to this tenant AND this product
            safe_pkgs = []
            for p in pkgs:
                try:
                    if str(getattr(p, 'tenant_id', '')) != str(tenant_id):
                        continue
                    pid = getattr(p, 'product_id', None)
                    if pid is None:
                        # fallback: try reverse relation's id
                        pid = getattr(getattr(p, 'product', None), 'id', None)
                    if pid not in (getattr(prod, 'id', None), str(getattr(prod, 'id', None))):
                        continue
                except Exception:
                    continue
                safe_pkgs.append(p)
            pkgs = safe_pkgs
            if not include_all:
                pkgs = [p for p in pkgs if p.public_code is not None and p.is_active]
            # sort: unit first then by publicCode then name
            pkgs.sort(key=lambda p: (
                0 if getattr(p, 'type', None) == 'unit' else 1,
                getattr(p, 'public_code', 9999999) if getattr(p, 'public_code', None) is not None else 9999999,
                (p.name or ''),
            ))
            # store filtered list on a temp attribute to avoid mutating reverse relation
            setattr(prod, '_filtered_packages', pkgs)
            items.append(prod)
        try:
            ser = ProductListSerializer(items, many=True, context={'all_price_groups': groups})
            return Response(ser.data)
        except Exception:
            # Minimal fallback serializer structure
            out = []
            for prod in items:
                pkgs = []
                src_pk = getattr(prod, '_filtered_packages', None)
                if src_pk is None:
                    rel = getattr(prod, 'packages', None)
                    if hasattr(rel, 'all'):
                        src_pk = list(rel.all())
                    else:
                        src_pk = list(rel or [])
                for p in src_pk:
                    pkgs.append({
                        'id': str(p.id),
                        'tenant_id': str(p.tenant_id),
                        'public_code': p.public_code,
                        'name': p.name,
                        'description': p.description,
                        'image_url': p.image_url,
                        'basePrice': p.base_price or p.capital or 0,
                        'capital': p.capital,
                        'type': getattr(p, 'type', 'fixed'),
                        'unit_name': p.unit_name,
                        'unit_code': p.unit_code,
                        'min_units': p.min_units,
                        'max_units': p.max_units,
                        'step': p.step,
                        'provider_name': p.provider_name,
                        'is_active': p.is_active,
                        'prices': [],
                    })
                out.append({
                    'id': str(prod.id),
                    'tenant_id': str(prod.tenant_id),
                    'name': prod.name,
                    'description': getattr(prod, 'description', None),
                    'is_active': prod.is_active,
                    'supports_counter': getattr(prod, 'supports_counter', False),
                    'imageUrl': getattr(prod, 'custom_image_url', None) or None,
                    'custom_image_url': getattr(prod, 'custom_image_url', None),
                    'thumb_small_url': getattr(prod, 'thumb_small_url', None),
                    'thumb_medium_url': getattr(prod, 'thumb_medium_url', None),
                    'thumb_large_url': getattr(prod, 'thumb_large_url', None),
                    'packages': pkgs,
                })
            return Response(out)


class ProductDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if not tenant_id:
            raise NotFound('tenantId مفقود')
        if str(tenant_id) == GLOBAL_ID:
            raise NotFound('غير متاح على المخزن العالمي')
        groups = list(PriceGroup.objects.filter(tenant_id=tenant_id))
        pk_qs = ProductPackage.objects.filter(tenant_id=tenant_id, product_id=id).prefetch_related(
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
        pkgs_rel = getattr(product, 'packages', None)
        if hasattr(pkgs_rel, 'all'):
            pkgs = list(pkgs_rel.all())
        else:
            pkgs = list(pkgs_rel or [])
        # Hard isolation: keep only packages belonging to this tenant AND this product
        safe_pkgs = []
        for p in pkgs:
            try:
                if str(getattr(p, 'tenant_id', '')) != str(tenant_id):
                    continue
                pid = getattr(p, 'product_id', None)
                if pid is None:
                    pid = getattr(getattr(p, 'product', None), 'id', None)
                if pid not in (getattr(product, 'id', None), str(getattr(product, 'id', None))):
                    continue
            except Exception:
                continue
            safe_pkgs.append(p)
        pkgs = safe_pkgs
        pkgs = [p for p in pkgs if p.public_code is not None and p.is_active]
        pkgs.sort(key=lambda p: (
            0 if getattr(p, 'type', None) == 'unit' else 1,
            getattr(p, 'public_code', 9999999) if getattr(p, 'public_code', None) is not None else 9999999,
            (p.name or ''),
        ))
        setattr(product, '_filtered_packages', pkgs)
        try:
            ser = ProductDetailSerializer(product, context={'all_price_groups': groups})
            return Response(ser.data)
        except Exception:
            # Minimal fallback to avoid 500s if serializer hits an edge case
            out_pkgs = []
            for p in getattr(product, '_filtered_packages', []):
                out_pkgs.append({
                    'id': str(p.id),
                    'tenant_id': str(p.tenant_id),
                    'public_code': p.public_code,
                    'name': p.name,
                    'description': p.description,
                    'image_url': p.image_url,
                    'basePrice': p.base_price or p.capital or 0,
                    'capital': p.capital,
                    'type': getattr(p, 'type', 'fixed'),
                    'unit_name': p.unit_name,
                    'unit_code': p.unit_code,
                    'min_units': p.min_units,
                    'max_units': p.max_units,
                    'step': p.step,
                    'provider_name': p.provider_name,
                    'is_active': p.is_active,
                    'prices': [],
                })
            return Response({
                'id': str(product.id),
                'tenant_id': str(product.tenant_id),
                'name': product.name,
                'description': getattr(product, 'description', None),
                'is_active': product.is_active,
                'supports_counter': getattr(product, 'supports_counter', False),
                'imageUrl': getattr(product, 'custom_image_url', None) or None,
                'custom_image_url': getattr(product, 'custom_image_url', None),
                'thumb_small_url': getattr(product, 'thumb_small_url', None),
                'thumb_medium_url': getattr(product, 'thumb_medium_url', None),
                'thumb_large_url': getattr(product, 'thumb_large_url', None),
                'packages': out_pkgs,
            })


    def delete(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        if str(tenant_id) == GLOBAL_ID:
            raise ValidationError('لا يُسمح بتعديل المخزن العالمي عبر واجهة المستأجر')
        try:
            product = Product.objects.get(id=id, tenant_id=tenant_id)
        except Product.DoesNotExist:
            raise NotFound('المنتج غير موجود')

        pkg_ids = list(ProductPackage.objects.filter(product_id=id, tenant_id=tenant_id).values_list('id', flat=True))
        try:
            with transaction.atomic():
                if pkg_ids:
                    PackagePrice.objects.filter(package_id__in=pkg_ids).delete()
                    ProductPackage.objects.filter(id__in=pkg_ids).delete()
                product.delete()
        except IntegrityError:
            # Roll back to safe disable if there are FK references (مثل الطلبات المرتبطة)
            Product.objects.filter(id=id, tenant_id=tenant_id).update(is_active=False)
            if pkg_ids:
                ProductPackage.objects.filter(id__in=pkg_ids).update(is_active=False)
            return Response({'message': 'تم تعطيل المنتج بسبب وجود سجلات مرتبطة'}, status=200)

        return Response({'message': 'تم حذف المنتج'}, status=200)


class UserProductDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id: str):
        base_response = ProductDetailView().get(request, id)
        data = getattr(base_response, 'data', None)
        if not isinstance(data, dict):
            return base_response

        user = getattr(request, 'user', None)
        if isinstance(user, LegacyUser):
            currency_code = getattr(user, 'preferred_currency_code', None) or 'USD'
            price_group_id = getattr(user, 'price_group_id', None)
        else:
            currency_code = getattr(user, 'currency', None) or getattr(user, 'currency_code', None) or 'USD'
            price_group_id = getattr(user, 'price_group_id', None)

        if currency_code:
            data['currencyCode'] = currency_code
            data.setdefault('currency_code', currency_code)

        price_group_id_str = str(price_group_id) if price_group_id else None
        data['priceGroupId'] = price_group_id_str
        if price_group_id_str and not data.get('priceGroup'):
            data['priceGroup'] = {'id': price_group_id_str}

        packages = data.get('packages')
        if isinstance(packages, list):
            for pkg in packages:
                if not isinstance(pkg, dict):
                    continue
                prices = pkg.get('prices')
                selected = None
                if isinstance(prices, list) and prices:
                    # Normalize price rows to dict form
                    for row in prices:
                        if not isinstance(row, dict):
                            continue
                        row_group = row.get('groupId') or row.get('priceGroupId')
                        if row_group and price_group_id_str and str(row_group) == price_group_id_str:
                            selected = row
                            break
                    if not selected:
                        selected = next((row for row in prices if isinstance(row, dict)), None)

                base_price_raw = pkg.get('basePrice')
                price_value = None
                if isinstance(selected, dict) and selected.get('price') is not None:
                    try:
                        price_value = float(selected.get('price'))
                    except (TypeError, ValueError):
                        price_value = None
                if price_value is None and base_price_raw is not None:
                    try:
                        price_value = float(base_price_raw)
                    except (TypeError, ValueError):
                        price_value = None
                if price_value is None and isinstance(prices, list):
                    for row in prices:
                        if isinstance(row, dict) and row.get('price') is not None:
                            try:
                                price_value = float(row.get('price'))
                                break
                            except (TypeError, ValueError):
                                continue
                if price_value is None:
                    price_value = 0.0

                # Rehydrate prices list with a single, normalized entry
                group_id = price_group_id_str
                if not group_id and isinstance(selected, dict):
                    group_candidate = selected.get('groupId') or selected.get('priceGroupId')
                    if group_candidate:
                        group_id = str(group_candidate)
                pkg['prices'] = [{
                    'groupId': group_id,
                    'priceGroupId': group_id,
                    'price': price_value,
                }]
        base_response.data = data
        return base_response


class ProductBridgesView(APIView):
    """Return available bridge codes (publicCode values) from the source global product.

    Mirrors the legacy NestJS logic:
      * Resolve tenant and ensure product belongs to tenant (not GLOBAL).
      * If source_global_product_id missing, infer by matching package codes/names.
      * Return global package codes not already used locally (even if الباقة غير مفعّلة).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        if str(tenant_id) == GLOBAL_ID:
            return Response({'available': []})

        try:
            product = Product.objects.get(id=id, tenant_id=tenant_id)
        except Product.DoesNotExist:
            raise NotFound('المنتج غير موجود')

        # Collect local packages and their bridge codes
        local_pkgs = list(ProductPackage.objects.filter(product_id=id, tenant_id=tenant_id))
        local_codes = {int(pkg.public_code) for pkg in local_pkgs if pkg.public_code is not None}

        source_global_id = getattr(product, 'source_global_product_id', None)
        if not source_global_id and local_codes:
            inferred_id = self._infer_global_product_id(product, local_codes)
            if inferred_id:
                source_global_id = inferred_id
                # Persist inference (best-effort)
                try:
                    Product.objects.filter(id=product.id, tenant_id=tenant_id).update(source_global_product_id=inferred_id)
                    product.source_global_product_id = inferred_id
                except Exception:
                    pass

        if not source_global_id:
            return Response({'available': []})

        global_codes = set(
            int(code)
            for code in ProductPackage.objects.filter(
                product_id=source_global_id,
                tenant_id=GLOBAL_ID,
                is_active=True,
                public_code__isnull=False,
            ).values_list('public_code', flat=True)
        )
        for code in local_codes:
            global_codes.discard(code)

        return Response({'available': sorted(global_codes)})

    def _infer_global_product_id(self, product: Product, local_codes: set[int]) -> str | None:
        """Infer the matching global product when source_global_product_id is missing."""
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        # 1) Try exact name match producing overlapping codes
        same_name_ids = list(
            Product.objects.filter(tenant_id=GLOBAL_ID, name=product.name).values_list('id', flat=True)
        )
        if len(same_name_ids) == 1:
            candidate_id = same_name_ids[0]
            overlap_exists = ProductPackage.objects.filter(
                product_id=candidate_id,
                tenant_id=GLOBAL_ID,
                public_code__in=local_codes,
            ).exists()
            if overlap_exists:
                return str(candidate_id)

        # 2) Fallback: find global product sharing the most codes
        overlap_counts: dict[str, int] = {}
        matches = ProductPackage.objects.filter(
            tenant_id=GLOBAL_ID,
            public_code__in=local_codes,
        ).values_list('product_id', 'public_code')
        for product_id_val, code in matches:
            if product_id_val is None or code is None:
                continue
            key = str(product_id_val)
            overlap_counts[key] = overlap_counts.get(key, 0) + 1

        if not overlap_counts:
            return None

        best_id, best_overlap = max(overlap_counts.items(), key=lambda item: item[1])
        if best_overlap >= 2 or (best_overlap == 1 and len(local_codes) == 1):
            exists = Product.objects.filter(id=best_id, tenant_id=GLOBAL_ID).exists()
            if exists:
                return best_id
        return None


class AdminProductSupportsCounterView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def patch(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if not tenant_id:
            raise ValidationError('tenantId مفقود')

        supports_counter = request.data.get('supportsCounter')
        if supports_counter is None:
            supports_counter = request.data.get('supports_counter')
        if supports_counter is None:
            raise ValidationError('قيمة supportsCounter مطلوبة')
        supports_counter = str(supports_counter).lower() in ('1', 'true', 't', 'yes', 'y')

        # Allow toggling only on tenant-owned products (not the global catalog)
        if str(tenant_id) == GLOBAL_ID:
            raise ValidationError('لا يمكن تعديل منتجات المخزن العالمي من هذه الواجهة')

        try:
            updated = Product.objects.filter(id=id, tenant_id=tenant_id).update(supports_counter=supports_counter)
        except Exception:
            updated = 0
        if not updated:
            raise NotFound('المنتج غير موجود')

        return Response({'message': 'تم التحديث', 'supportsCounter': supports_counter})


class PackagePricesFetchView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('tenantId مفقود')

        raw_ids = request.data.get('packageIds') or []
        if not isinstance(raw_ids, (list, tuple, set)):
            raise ValidationError('قائمة packageIds مطلوبة')

        normalized_ids: list[str] = []
        for raw in raw_ids:
            try:
                normalized_ids.append(str(uuid.UUID(str(raw))))
            except Exception:
                continue
        if not normalized_ids:
            return Response([])

        packages = list(ProductPackage.objects.filter(id__in=normalized_ids, tenant_id=tenant_id))
        if not packages:
            return Response([])

        package_map = {str(pkg.id): pkg for pkg in packages}
        price_rows = PackagePrice.objects.filter(
            package_id__in=list(package_map.keys()),
            tenant_id=tenant_id,
        ).select_related('price_group')

        grouped: dict[str, list[dict[str, object]]] = {pid: [] for pid in package_map.keys()}
        for row in price_rows:
            pid = str(getattr(row, 'package_id', getattr(row, 'package_id', None)) or row.package_id)
            if pid not in grouped:
                continue
            grouped[pid].append({
                'id': str(row.id),
                'groupId': str(getattr(row, 'price_group_id', None) or getattr(row.price_group, 'id', '')),
                'groupName': getattr(row.price_group, 'name', ''),
                'price': float(row.price or 0),
            })

        output = []
        for pid, pkg in package_map.items():
            capital_val = pkg.base_price if getattr(pkg, 'base_price', None) is not None else pkg.capital
            output.append({
                'packageId': pid,
                'capital': float(capital_val or 0),
                'prices': grouped.get(pid, []),
            })
        return Response(output)


class PackagePricesUpdateView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def put(self, request, pkg_id: str):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        if str(tenant_id) == GLOBAL_ID:
            raise ValidationError('لا يُسمح بتعديل المخزن العالمي عبر واجهة المستأجر')

        pkg = _get_pkg_for_tenant_or_404(str(tenant_id), pkg_id)

        capital_raw = request.data.get('capital')
        if capital_raw is not None:
            try:
                capital_val = Decimal(str(capital_raw))
            except (InvalidOperation, ValueError):
                raise ValidationError('رأس المال غير صالح')
            ProductPackage.objects.filter(id=pkg.id, tenant_id=tenant_id).update(
                capital=capital_val,
                base_price=capital_val,
            )
            pkg.capital = capital_val
            setattr(pkg, 'base_price', capital_val)

        prices_payload = request.data.get('prices') or []
        if not isinstance(prices_payload, list):
            raise ValidationError('قائمة الأسعار مطلوبة')

        group_ids_needed: set[str] = set()
        normalized_prices = []
        for item in prices_payload:
            group_id = item.get('groupId') or item.get('group_id') or item.get('price_group')
            if not group_id:
                continue
            try:
                gid = str(uuid.UUID(str(group_id)))
            except Exception:
                continue
            price_val_raw = item.get('price', 0)
            try:
                price_val = Decimal(str(price_val_raw))
            except (InvalidOperation, ValueError):
                raise ValidationError('قيمة السعر غير صالحة')
            normalized_prices.append((gid, price_val))
            group_ids_needed.add(gid)

        group_lookup = {
            str(row.id): row
            for row in PriceGroup.objects.filter(tenant_id=tenant_id, id__in=list(group_ids_needed))
        }

        existing_rows = {
            str(row.price_group_id): row
            for row in PackagePrice.objects.filter(package_id=pkg.id, tenant_id=tenant_id)
        }

        updated_rows: list[PackagePrice] = []
        for gid, price_val in normalized_prices:
            group_obj = group_lookup.get(gid)
            if not group_obj:
                continue
            existing = existing_rows.get(gid)
            if existing:
                existing.price = price_val
                existing.save(update_fields=['price'])
                updated_rows.append(existing)
            else:
                new_row = PackagePrice(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    package=pkg,
                    price_group=group_obj,
                    price=price_val,
                )
                new_row.save(force_insert=True)
                updated_rows.append(new_row)

        # Reload all rows for response (to include names and ids)
        fresh_rows = PackagePrice.objects.filter(
            package_id=pkg.id,
            tenant_id=tenant_id,
        ).select_related('price_group').order_by('price_group__name')

        response_items = [
            {
                'id': str(row.id),
                'groupId': str(getattr(row, 'price_group_id', None) or getattr(row.price_group, 'id', '')),
                'groupName': getattr(row.price_group, 'name', ''),
                'price': float(row.price or 0),
            }
            for row in fresh_rows
        ]

        capital_resp = getattr(pkg, 'base_price', None)
        if capital_resp is None:
            capital_resp = pkg.capital

        return Response({
            'packageId': str(pkg.id),
            'capital': float(capital_resp or 0),
            'prices': response_items,
        })


def _get_pkg_for_tenant_or_404(tenant_id: str, pkg_id: str) -> ProductPackage:
    try:
        pkg = ProductPackage.objects.select_related('product').get(id=pkg_id, tenant_id=tenant_id)
    except ProductPackage.DoesNotExist:
        raise NotFound('الباقة غير موجودة')
    # Extra guard: ensure the parent product also belongs to the tenant (prevents touching global)
    try:
        if str(getattr(pkg.product, 'tenant_id', '')) != str(tenant_id):
            raise NotFound('الباقة غير موجودة')
    except AttributeError:
        raise NotFound('الباقة غير موجودة')
    return pkg


class ProductPackagesCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        if str(tenant_id) == GLOBAL_ID:
            raise ValidationError('لا يُسمح بتعديل المخزن العالمي عبر واجهة المستأجر')
        # Ensure product exists and belongs to tenant
        try:
            product = Product.objects.get(id=id, tenant_id=tenant_id)
        except Product.DoesNotExist:
            raise NotFound('المنتج غير موجود')
        name = (request.data.get('name') or '').strip()
        if not name:
            raise ValidationError('اسم الباقة مطلوب')
        description = request.data.get('description') or None
        is_active = str(request.data.get('isActive') or request.data.get('is_active') or 'true').lower() in ('1','true','t','yes','y')
        ptype = (request.data.get('type') or 'fixed').strip()
        # base price
        base_price_raw = request.data.get('basePrice')
        try:
            base_price = Decimal(str(base_price_raw or 0))
        except (InvalidOperation, ValueError):
            base_price = Decimal('0')
        # code
        public_code_raw = request.data.get('publicCode')
        public_code = None
        if public_code_raw not in (None, ''):
            try:
                public_code = int(public_code_raw)
            except Exception:
                raise ValidationError('قيمة الكود غير صالحة')
        # Unit fields (optional)
        unit_name = (request.data.get('unitName') or None)
        unit_code = (request.data.get('unitCode') or None)
        min_units = request.data.get('minUnits'); min_units = int(min_units) if (min_units not in (None, '')) else None
        max_units = request.data.get('maxUnits'); max_units = int(max_units) if (max_units not in (None, '')) else None
        step_raw = request.data.get('step'); step = None
        if step_raw not in (None, ''):
            try:
                step = Decimal(str(step_raw))
            except (InvalidOperation, ValueError):
                step = None
        # Ensure code uniqueness within the SAME product (allow reuse across different products)
        if public_code is not None and ProductPackage.objects.filter(tenant_id=tenant_id, product_id=product.id, public_code=public_code).exists():
            raise ValidationError('الكود مستخدم مسبقاً داخل هذا المنتج')
        pkg = ProductPackage(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            product=product,
            name=name,
            description=description,
            base_price=base_price,
            public_code=public_code,
            is_active=is_active,
            type=ptype,
            unit_name=unit_name,
            unit_code=unit_code,
            min_units=min_units,
            max_units=max_units,
            step=step,
        )
        pkg.save(force_insert=True)
        return Response({'id': str(pkg.id)}, status=201)


class PackageBasicUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pkg_id: str):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        if str(tenant_id) == GLOBAL_ID:
            raise ValidationError('لا يُسمح بتعديل المخزن العالمي عبر واجهة المستأجر')
        pkg = _get_pkg_for_tenant_or_404(tenant_id, pkg_id)
        name = request.data.get('name')
        if name is not None:
            name = str(name).strip()
            if not name:
                raise ValidationError('اسم الباقة مطلوب')
            pkg.name = name
        if 'description' in request.data:
            pkg.description = request.data.get('description') or None
        if 'basePrice' in request.data:
            try:
                pkg.base_price = Decimal(str(request.data.get('basePrice') or 0))
            except (InvalidOperation, ValueError):
                raise ValidationError('سعر غير صالح')
        if 'isActive' in request.data or 'is_active' in request.data:
            val = str(request.data.get('isActive') if 'isActive' in request.data else request.data.get('is_active')).lower()
            pkg.is_active = val in ('1','true','t','yes','y')
        pkg.save(update_fields=['name','description','base_price','is_active'])
        return Response({'message': 'تم الحفظ'})


class PackageCodeUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pkg_id: str):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        if str(tenant_id) == GLOBAL_ID:
            raise ValidationError('لا يُسمح بتعديل المخزن العالمي عبر واجهة المستأجر')
        pkg = _get_pkg_for_tenant_or_404(tenant_id, pkg_id)
        raw = request.data.get('publicCode')
        if raw in (None, ''):
            pkg.public_code = None
        else:
            try:
                new_code = int(raw)
            except Exception:
                raise ValidationError('قيمة الكود غير صالحة')
            # Unique within the same product for this tenant (allow same code on other products)
            if ProductPackage.objects.filter(tenant_id=tenant_id, product_id=pkg.product_id, public_code=new_code).exclude(id=pkg.id).exists():
                raise ValidationError('الكود مستخدم مسبقاً داخل هذا المنتج')
            pkg.public_code = new_code
        pkg.save(update_fields=['public_code'])
        return Response({'message': 'تم تحديث الكود'})


class PackageUnitUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pkg_id: str):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        if str(tenant_id) == GLOBAL_ID:
            raise ValidationError('لا يُسمح بتعديل المخزن العالمي عبر واجهة المستأجر')
        pkg = _get_pkg_for_tenant_or_404(tenant_id, pkg_id)
        # At least unitName required by UI
        unit_name = request.data.get('unitName')
        if unit_name is not None:
            unit_name = str(unit_name).strip()
            if not unit_name:
                raise ValidationError('اسم الوحدة مطلوب')
            pkg.unit_name = unit_name
        # Optional
        if 'unitCode' in request.data:
            val = request.data.get('unitCode')
            pkg.unit_code = (str(val).strip() or None) if val is not None else None
        def _to_int_or_none(v):
            if v in (None, ''): return None
            try: return int(v)
            except Exception: return None
        if 'minUnits' in request.data:
            pkg.min_units = _to_int_or_none(request.data.get('minUnits'))
        if 'maxUnits' in request.data:
            pkg.max_units = _to_int_or_none(request.data.get('maxUnits'))
        if 'step' in request.data:
            val = request.data.get('step')
            if val in (None, ''):
                pkg.step = None
            else:
                try:
                    pkg.step = Decimal(str(val))
                except (InvalidOperation, ValueError):
                    raise ValidationError('قيمة step غير صالحة')
        pkg.save(update_fields=['unit_name','unit_code','min_units','max_units','step'])
        return Response({'message': 'تم تحديث إعدادات العداد'})


class PackageDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pkg_id: str):
        tenant_id = _resolve_tenant_id(request)
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        if str(tenant_id) == GLOBAL_ID:
            raise ValidationError('لا يُسمح بتعديل المخزن العالمي عبر واجهة المستأجر')
        pkg = _get_pkg_for_tenant_or_404(tenant_id, pkg_id)
        pkg.delete()
        return Response({'message': 'تم حذف الباقة'})


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


class GlobalProductsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Global container (no tenant) mirrors legacy behavior
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        # Some databases store global rows with tenant_id IS NULL instead of zero-UUID
        products = list(
            Product.objects
            .filter(Q(tenant_id=GLOBAL_ID) | Q(tenant_id__isnull=True))
            .order_by('name')
        )
        items = []
        for p in products:
            count = ProductPackage.objects.filter(product_id=p.id, tenant_id=GLOBAL_ID, is_active=True, public_code__isnull=False).count()
            items.append({
                'id': str(p.id),
                'name': p.name,
                'packagesActiveCount': count,
            })
        # Dev fallback: if no explicit global rows exist, derive catalog entries from references
        if not items:
            refs = (
                Product.objects
                .exclude(source_global_product_id__isnull=True)
                .values_list('source_global_product_id', flat=True)
                .distinct()
            )
            for gid in refs:
                if not gid:
                    continue
                example = (
                    Product.objects
                    .filter(source_global_product_id=gid)
                    .order_by('name')
                    .first()
                )
                if not example:
                    continue
                count = ProductPackage.objects.filter(product__source_global_product_id=gid, is_active=True, public_code__isnull=False).count()
                items.append({
                    'id': str(gid),
                    'name': example.name,
                    'packagesActiveCount': count,
                })
        return Response({ 'items': items })


class CloneGlobalToTenantView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        # Ensure UUID format
        try:
            tenant_uuid = uuid.UUID(str(tenant_id))
        except Exception:
            raise ValidationError('tenantId غير صالح')
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        # Try to find a true global product row
        try:
            src = Product.objects.filter(id=id).filter(Q(tenant_id=GLOBAL_ID) | Q(tenant_id__isnull=True)).first()
        except Exception:
            src = None
        source_gid = None
        used_example = False
        if src is None:
            # Treat provided id as source_global_product_id (fallback)
            try:
                source_gid = uuid.UUID(str(id))
            except Exception:
                raise NotFound('المنتج المطلوب غير موجود بالمخزن')
            example = Product.objects.filter(source_global_product_id=source_gid).order_by('name').first()
            if not example:
                raise NotFound('المنتج المطلوب غير موجود بالمخزن')
            src = example
            used_example = True
        else:
            source_gid = src.id
        # If no true global row exists for this source, create one now to decouple catalog from tenant data
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        if used_example:
            try:
                global_exists = Product.objects.filter(id=source_gid, tenant_id=GLOBAL_ID).exists()
            except Exception:
                global_exists = False
            if not global_exists:
                try:
                    # Create a stable global product using example's metadata
                    global_prod = Product(
                        id=source_gid,
                        tenant_id=uuid.UUID(GLOBAL_ID),
                        name=src.name,
                        description=getattr(src, 'description', None),
                        custom_image_url=getattr(src, 'custom_image_url', None),
                        custom_alt_text=getattr(src, 'custom_alt_text', None),
                        thumb_small_url=getattr(src, 'thumb_small_url', None),
                        thumb_medium_url=getattr(src, 'thumb_medium_url', None),
                        thumb_large_url=getattr(src, 'thumb_large_url', None),
                        is_active=True,
                        supports_counter=getattr(src, 'supports_counter', False),
                        source_global_product_id=None,
                    )
                    global_prod.save(force_insert=True)
                    # Seed global packages based on available example packages
                    seed_src_packages = ProductPackage.objects.filter(product_id=src.id)
                    created_global_codes: set[int] = set()
                    for pk in seed_src_packages:
                        try:
                            code_val = int(pk.public_code) if pk.public_code is not None else None
                        except Exception:
                            code_val = None
                        # Ensure we don't duplicate codes in global product
                        if code_val is not None:
                            if code_val in created_global_codes or ProductPackage.objects.filter(product_id=global_prod.id, public_code=code_val).exists():
                                continue
                            created_global_codes.add(code_val)
                        gpk = ProductPackage(
                            id=uuid.uuid4(),
                            tenant_id=uuid.UUID(GLOBAL_ID),
                            product=global_prod,
                            public_code=code_val,
                            name=pk.name,
                            description=pk.description,
                            image_url=pk.image_url,
                            base_price=pk.base_price,
                            capital=pk.capital,
                            type=pk.type,
                            unit_name=pk.unit_name,
                            unit_code=pk.unit_code,
                            min_units=pk.min_units,
                            max_units=pk.max_units,
                            step=pk.step,
                            provider_name=pk.provider_name,
                            is_active=pk.is_active,
                        )
                        try:
                            gpk.save(force_insert=True)
                        except IntegrityError:
                            continue
                except Exception:
                    # Non-fatal: cloning can proceed even if global seeding fails
                    pass

        # Create or reuse a tenant product if already cloned
        existing = Product.objects.filter(tenant_id=tenant_uuid, source_global_product_id=source_gid).first()
        if existing:
            return Response({ 'id': str(existing.id), 'message': 'تم الاستنساخ مسبقاً' })
        new_prod = Product(
            id=uuid.uuid4(),
            tenant_id=tenant_uuid,
            name=src.name,
            description=getattr(src, 'description', None),
            custom_image_url=getattr(src, 'custom_image_url', None),
            custom_alt_text=getattr(src, 'custom_alt_text', None),
            thumb_small_url=getattr(src, 'thumb_small_url', None),
            thumb_medium_url=getattr(src, 'thumb_medium_url', None),
            thumb_large_url=getattr(src, 'thumb_large_url', None),
            is_active=True,
            supports_counter=getattr(src, 'supports_counter', False),
            source_global_product_id=source_gid,
        )
        new_prod.save(force_insert=True)
        # Determine source packages for tenant: prefer packages directly under true global src; else from any product referencing source_gid
        if ProductPackage.objects.filter(product_id=source_gid, tenant_id=GLOBAL_ID).exists():
            src_packages = ProductPackage.objects.filter(product_id=source_gid, tenant_id=GLOBAL_ID)
        elif ProductPackage.objects.filter(product_id=source_gid).exists():
            src_packages = ProductPackage.objects.filter(product_id=source_gid)
        else:
            any_ref = Product.objects.filter(source_global_product_id=source_gid).values_list('id', flat=True)
            src_packages = ProductPackage.objects.filter(product_id__in=list(any_ref))
        # Prepare code allocation to avoid conflicts WITHIN THIS PRODUCT (allow reuse across products)
        used_codes_qs = ProductPackage.objects.filter(
            tenant_id=new_prod.tenant_id,
            product_id=new_prod.id,
            public_code__isnull=False
        ).values_list('public_code', flat=True)
        used_codes = set(int(c) for c in used_codes_qs if c is not None)
        assigned: set[int] = set()
        def is_taken(n: int) -> bool:
            return n in used_codes or n in assigned
        def next_available(start: int) -> int:
            n = int(start) if isinstance(start, int) and start > 0 else 1
            while is_taken(n):
                n += 1
            assigned.add(n)
            return n
        created = 0
        for pk in src_packages:
            # Choose a public_code: keep if free; otherwise allocate next available
            desired = None
            try:
                desired = int(pk.public_code) if pk.public_code is not None else None
            except Exception:
                desired = None
            if desired is not None and desired > 0 and not is_taken(desired):
                code_to_use = desired
                assigned.add(desired)
            else:
                code_to_use = next_available((desired or 0) + 1)
            npk = ProductPackage(
                id=uuid.uuid4(),
                tenant_id=new_prod.tenant_id,
                product=new_prod,
                public_code=code_to_use,
                name=pk.name,
                description=pk.description,
                image_url=pk.image_url,
                base_price=pk.base_price,
                capital=pk.capital,
                type=pk.type,
                unit_name=pk.unit_name,
                unit_code=pk.unit_code,
                min_units=pk.min_units,
                max_units=pk.max_units,
                step=pk.step,
                provider_name=pk.provider_name,
                is_active=pk.is_active,
            )
            try:
                npk.save(force_insert=True)
                created += 1
            except IntegrityError:
                # Rare race: allocate a new code and retry once
                try:
                    npk.public_code = next_available((desired or 0) + 1)
                    npk.id = uuid.uuid4()
                    npk.save(force_insert=True)
                    created += 1
                except IntegrityError:
                    continue
        return Response({ 'id': str(new_prod.id), 'packages': created, 'message': 'تم الاستنساخ بنجاح' })


class SyncFromGlobalView(APIView):
    """Pull new global packages into an already-cloned tenant product.
    - Only copies active global packages with a public_code.
    - Skips any package whose public_code is already used within the tenant to avoid surprises.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('tenantId مفقود')
        # Ensure product exists in tenant and is a clone from global
        try:
            product = Product.objects.get(id=id, tenant_id=tenant_id)
        except Product.DoesNotExist:
            raise NotFound('المنتج غير موجود')
        source_gid = getattr(product, 'source_global_product_id', None)
        if not source_gid:
            raise ValidationError('هذا المنتج ليس منسوخاً من المخزن العالمي')
        GLOBAL_ID = '00000000-0000-0000-0000-000000000000'
        # Prefer true global packages
        global_pkgs = ProductPackage.objects.filter(
            product_id=source_gid,
            tenant_id=GLOBAL_ID,
            is_active=True,
            public_code__isnull=False,
        )
        created = 0
        skipped_conflict = 0
        # Codes currently used within THIS product (allow duplicates across products)
        used_codes = set(
            int(c) for c in ProductPackage.objects.filter(
                tenant_id=tenant_id,
                product_id=product.id,
                public_code__isnull=False
            ).values_list('public_code', flat=True)
            if c is not None
        )
        for gpk in global_pkgs:
            try:
                desired = int(gpk.public_code)
            except Exception:
                continue
            if desired in used_codes:
                skipped_conflict += 1
                continue
            npk = ProductPackage(
                id=uuid.uuid4(),
                tenant_id=uuid.UUID(str(tenant_id)),
                product=product,
                public_code=desired,
                name=gpk.name,
                description=gpk.description,
                image_url=gpk.image_url,
                base_price=gpk.base_price,
                capital=gpk.capital,
                type=gpk.type,
                unit_name=gpk.unit_name,
                unit_code=gpk.unit_code,
                min_units=gpk.min_units,
                max_units=gpk.max_units,
                step=gpk.step,
                provider_name=gpk.provider_name,
                is_active=gpk.is_active,
            )
            try:
                npk.save(force_insert=True)
                used_codes.add(desired)
                created += 1
            except IntegrityError:
                skipped_conflict += 1
                continue
        return Response({ 'created': created, 'skipped': skipped_conflict })
