from __future__ import annotations

import uuid
from django.db import IntegrityError
from django.db.models import F
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, NotFound
from .models import Currency
from .serializers import CurrencySerializer, CurrencyCreateUpdateSerializer
from apps.products.views import _resolve_tenant_id


def _parse_bool(v):
    if isinstance(v, bool):
        return v
    if v is None:
        return None
    return str(v).lower() in ('1','true','t','yes','y')


class CurrenciesListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        qs = Currency.objects.filter(tenant_id=tenant_id).order_by('code')
        return Response(CurrencySerializer(qs, many=True).data)

    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        payload = CurrencyCreateUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        # enforce unique code per tenant
        code = data.get('code')
        if code and Currency.objects.filter(tenant_id=tenant_id, code=code).exists():
            raise ValidationError(f'Currency code "{code}" already exists for this tenant')
        cur = Currency(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            code=data.get('code') or '',
            name=data.get('name') or '',
            rate=data.get('rate') or 1,
            is_active=_parse_bool(data.get('isActive')) if 'isActive' in data else True,
            is_primary=_parse_bool(data.get('isPrimary')) if 'isPrimary' in data else False,
            symbol_ar=data.get('symbolAr') if 'symbolAr' in data else None,
        )
        cur.save(force_insert=True)
        # ensure single primary per tenant
        if cur.is_primary:
            Currency.objects.filter(tenant_id=tenant_id).exclude(id=cur.id).update(is_primary=False)
        return Response(CurrencySerializer(cur).data, status=201)


class CurrenciesBulkUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        body = request.data
        items = body if isinstance(body, list) else body.get('currencies')
        if not isinstance(items, list):
            raise ValidationError('Body must be an array of currencies or { currencies: [...] }')
        results = []
        primary_to_keep = None
        for raw in items:
            cid = raw.get('id') if isinstance(raw, dict) else None
            if not cid:
                continue
            try:
                cur = Currency.objects.get(id=cid, tenant_id=tenant_id)
            except Currency.DoesNotExist:
                continue
            # apply allowed fields
            if 'name' in raw:
                cur.name = raw['name']
            if 'code' in raw and raw['code'] != cur.code:
                if Currency.objects.filter(tenant_id=tenant_id, code=raw['code']).exclude(id=cur.id).exists():
                    raise ValidationError(f'Currency code "{raw["code"]}" already exists for this tenant')
                cur.code = raw['code']
            if 'rate' in raw:
                cur.rate = raw['rate']
            if 'isActive' in raw:
                cur.is_active = _parse_bool(raw['isActive'])
            if 'isPrimary' in raw:
                cur.is_primary = _parse_bool(raw['isPrimary'])
            if 'symbolAr' in raw:
                cur.symbol_ar = raw['symbolAr']
            cur.save(update_fields=['name','code','rate','is_active','is_primary','symbol_ar'])
            if cur.is_primary:
                primary_to_keep = cur.id
            results.append(cur)
        if primary_to_keep:
            Currency.objects.filter(tenant_id=tenant_id).exclude(id=primary_to_keep).update(is_primary=False)
        return Response(CurrencySerializer(results, many=True).data)


class CurrencyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            cur = Currency.objects.get(id=id, tenant_id=tenant_id)
        except Currency.DoesNotExist:
            raise NotFound('Currency not found for this tenant')
        payload = CurrencyCreateUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        if 'code' in data and data['code'] != cur.code:
            if Currency.objects.filter(tenant_id=tenant_id, code=data['code']).exclude(id=id).exists():
                raise ValidationError(f'Currency code "{data["code"]}" already exists for this tenant')
            cur.code = data['code']
        if 'name' in data:
            cur.name = data['name']
        if 'rate' in data:
            cur.rate = data['rate']
        if 'isActive' in data:
            cur.is_active = _parse_bool(data['isActive'])
        if 'isPrimary' in data:
            cur.is_primary = _parse_bool(data['isPrimary'])
        if 'symbolAr' in data:
            cur.symbol_ar = data['symbolAr']
        cur.save(update_fields=['name','code','rate','is_active','is_primary','symbol_ar'])
        if cur.is_primary:
            Currency.objects.filter(tenant_id=tenant_id).exclude(id=cur.id).update(is_primary=False)
        return Response(CurrencySerializer(cur).data)

    def delete(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        try:
            cur = Currency.objects.get(id=id, tenant_id=tenant_id)
        except Currency.DoesNotExist:
            raise NotFound('Currency not found for this tenant')
        cur.delete()
        return Response({ 'ok': True })


class CurrenciesSeedDefaultsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        defaults = [
            { 'code': 'USD', 'name': 'US Dollar',      'symbolAr': '$',  'isActive': True, 'rate': 1 },
            { 'code': 'EUR', 'name': 'Euro',           'symbolAr': '€',  'isActive': True, 'rate': 1 },
            { 'code': 'TRY', 'name': 'Turkish Lira',   'symbolAr': '₺',  'isActive': True, 'rate': 1 },
            { 'code': 'EGP', 'name': 'Egyptian Pound', 'symbolAr': '£',  'isActive': True, 'rate': 1 },
            { 'code': 'SAR', 'name': 'Saudi Riyal',    'symbolAr': '﷼',  'isActive': True, 'rate': 1 },
            { 'code': 'AED', 'name': 'UAE Dirham',     'symbolAr': 'د.إ','isActive': True, 'rate': 1 },
            { 'code': 'SYP', 'name': 'Syrian Pound',   'symbolAr': 'ل.س','isActive': True, 'rate': 1 },
        ]
        created_or_existing = []
        for d in defaults:
            existing = Currency.objects.filter(tenant_id=tenant_id, code=d['code']).first()
            if existing:
                created_or_existing.append(existing)
                continue
            cur = Currency(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                code=d['code'],
                name=d['name'],
                rate=d['rate'],
                is_active=d['isActive'],
                is_primary=False,
                symbol_ar=d['symbolAr'],
            )
            cur.save(force_insert=True)
            created_or_existing.append(cur)
        return Response(CurrencySerializer(created_or_existing, many=True).data)
