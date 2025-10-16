from __future__ import annotations

from datetime import datetime, timedelta, date
from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Dict, List
from django.db import ProgrammingError
from django.db.models import Sum, Count
from django.db.models.functions import TruncDate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, NotFound
from drf_spectacular.utils import extend_schema, OpenApiParameter
from django.http import HttpResponse
import csv

from apps.orders.models import ProductOrder
from apps.payments.models import Deposit
from apps.payouts.models import Payout
from apps.users.models import User
from apps.providers.models import Integration
from apps.currencies.models import Currency
from .models import CapitalAdjustment
from .serializers import (
    OverviewResponseSerializer,
    DailyResponseSerializer,
    CapitalAdjustmentSerializer,
    CapitalAdjustmentInputSerializer,
)
from apps.users.permissions import RequireAdminRole
from django.db.models import Q


def _resolve_tenant_id(request) -> str | None:
    tid = getattr(request, 'tenant', None)
    if tid and getattr(tid, 'id', None):
        return str(tid.id)
    user = getattr(request, 'user', None)
    if user and getattr(user, 'tenant_id', None):
        return str(user.tenant_id)
    return None


def _parse_dates(request):
    # Accept ISO date strings; default last 30 days
    q_from = (request.query_params.get('from') or '').strip()
    q_to = (request.query_params.get('to') or '').strip()
    try:
        dfrom = datetime.fromisoformat(q_from).date() if q_from else (date.today() - timedelta(days=29))
    except Exception:
        dfrom = date.today() - timedelta(days=29)
    try:
        dto = datetime.fromisoformat(q_to).date() if q_to else date.today()
    except Exception:
        dto = date.today()
    if dfrom > dto:
        dfrom, dto = dto, dfrom
    # Inclusive end
    return dfrom, dto


def _money_totals(rows, currency_field: str, amount_field: str):
    sums = defaultdict(lambda: 0)
    for r in rows:
        cur = getattr(r, currency_field) or 'USD'
        amt = getattr(r, amount_field) or 0
        try:
            sums[cur] += float(amt)
        except Exception:
            pass
    return [{ 'currency': k, 'amount': round(v, 6) } for k, v in sorted(sums.items())]


def _normalize_currency_code(raw: str | None) -> str:
    if not raw:
        return 'USD'
    return raw.strip().upper() or 'USD'


def _decimal_from(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal('0')
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')


def _to_float(value: Decimal, places: int = 4) -> float:
    if not isinstance(value, Decimal):
        value = _decimal_from(value)
    quant = Decimal('1').scaleb(-places)
    return float(value.quantize(quant, rounding=ROUND_HALF_UP))


def _infer_provider_currency(integration: Integration) -> str:
    possible = getattr(integration, 'balance_currency', None)
    if isinstance(possible, str) and possible.strip():
        return possible.strip().upper()
    raw_settings = getattr(integration, 'settings', None)
    settings = raw_settings if isinstance(raw_settings, dict) else None
    if settings:
        for key in ('balanceCurrency', 'balance_currency', 'currency', 'currencyCode', 'code'):
            val = settings.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip().upper()
    provider_code = (integration.provider or '').lower()
    name_code = (integration.name or '').lower()
    defaults = {
        'internal': 'USD',
        'barakat': 'TRY',
        'znet': 'TRY',
        'apstore': 'TRY',
        'shamtech': 'TRY',
    }
    if name_code in defaults:
        return defaults[name_code]
    return defaults.get(provider_code, 'USD')


class AdminReportsProfitsView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(
        tags=["Admin Reports"],
        parameters=[
            OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER),
            OpenApiParameter(name='range', required=False, type=str, description='today|this_month|last_month|last_6_months|custom'),
            OpenApiParameter(name='start', required=False, type=str),
            OpenApiParameter(name='end', required=False, type=str),
            OpenApiParameter(name='userId', required=False, type=str),
            OpenApiParameter(name='provider', required=False, type=str),
            OpenApiParameter(name='view', required=False, type=str, description='usd_only'),
        ],
        responses={200: None}
    )
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')

        # date range presets
        preset = (request.query_params.get('range') or 'today').strip()
        start = (request.query_params.get('start') or '').strip()
        end = (request.query_params.get('end') or '').strip()

        today = date.today()
        if preset == 'today':
            dfrom, dto = today, today
        elif preset == 'this_month':
            dfrom = today.replace(day=1)
            dto = today
        elif preset == 'last_month':
            first_this = today.replace(day=1)
            last_month_end = first_this - timedelta(days=1)
            dfrom = last_month_end.replace(day=1)
            dto = last_month_end
        elif preset == 'last_6_months':
            dfrom = today - timedelta(days=182)
            dto = today
        elif preset == 'custom':
            try:
                dfrom = datetime.fromisoformat(start).date() if start else today
            except Exception:
                dfrom = today
            try:
                dto = datetime.fromisoformat(end).date() if end else today
            except Exception:
                dto = today
        else:
            dfrom, dto = today, today

        user_id = (request.query_params.get('userId') or '').strip()
        provider = (request.query_params.get('provider') or '').strip()
        view = (request.query_params.get('view') or '').strip()

        # ✅ إصلاح: استخدام approved_local_date للطلبات المقبولة بدلاً من created_at
        # هذا يضمن تطابق العدادات مع الإجماليات المالية
        
        # بناء الاستعلام الأساسي (فقط للفلترة المشتركة)
        base_filters = {'tenant_id': tenant_id}
        if user_id:
            base_filters['user_id'] = user_id
        
        # فلترة المزود: يدوي = null/فارغ، وإلا نستخدم ID المزود
        provider_q_approved = Q()
        provider_q_rejected = Q()
        if provider:
            if provider.lower() == 'manual':
                # الطلبات اليدوية: provider_id فارغ أو null
                provider_q_approved = Q(provider_id__isnull=True) | Q(provider_id='')
                provider_q_rejected = Q(provider_id__isnull=True) | Q(provider_id='')
            else:
                # مزود محدد
                provider_q_approved = Q(provider_id=provider)
                provider_q_rejected = Q(provider_id=provider)

        # الطلبات المقبولة: نستخدم approved_local_date (تاريخ الموافقة)
        approved_qs = ProductOrder.objects.filter(
            **base_filters,
            status='approved',
            approved_local_date__gte=dfrom,
            approved_local_date__lte=dto,
        ).filter(provider_q_approved)

        # الطلبات المرفوضة: نستخدم created_at (ليس لها تاريخ موافقة)
        rejected_qs = ProductOrder.objects.filter(
            **base_filters,
            status='rejected',
            created_at__date__gte=dfrom,
            created_at__date__lte=dto,
        ).filter(provider_q_rejected)

        # حساب الإجماليات من القيم المجمّدة عند الموافقة
        total_cost_usd = 0.0
        total_sales_usd = 0.0

        # استخدام القيم المجمّدة من approved orders فقط
        for o in approved_qs.only('sell_try_at_approval', 'cost_try_at_approval', 'fx_usd_try_at_approval'):
            try:
                # القيم محفوظة بالليرة التركية عند الموافقة
                sell_try = float(o.sell_try_at_approval or 0)
                cost_try = float(o.cost_try_at_approval or 0)
                fx_rate = float(o.fx_usd_try_at_approval or 35.0)  # سعر الصرف المجمّد
                
                # تحويل إلى دولار
                if fx_rate > 0:
                    total_sales_usd += (sell_try / fx_rate)
                    total_cost_usd += (cost_try / fx_rate)
            except Exception:
                pass

        profit_usd = round(total_sales_usd - total_cost_usd, 2)
        
        # العدادات
        counts_approved = approved_qs.count()
        counts_rejected = rejected_qs.count()
        counts_total = counts_approved + counts_rejected

        # Stub TRY rate for UI display; if you have a table for FX, plug it here.
        # يمكن جلبها من جدول العملات لاحقاً
        rate_try = 35.0

        if view == 'usd_only':
            return Response({
                'filters': {
                    'range': preset,
                    'start': dfrom.isoformat(),
                    'end': dto.isoformat(),
                    'userId': user_id or None,
                    'provider': provider or None,
                    'view': 'usd_only',
                    'basis': 'approvedLocalDate',  # ✅ توضيح المعيار المستخدم
                },
                'counts': { 'total': counts_total, 'approved': counts_approved, 'rejected': counts_rejected },
                'totalsUSD': { 'cost': round(total_cost_usd, 2), 'sales': round(total_sales_usd, 2) },
                'profitUSD': profit_usd,
                'rateTRY': rate_try,
            })

        # Default dual display (TRY+USD) - here we only provide USD while keeping shape
        return Response({
            'filters': { 
                'range': preset, 
                'start': dfrom.isoformat(), 
                'end': dto.isoformat(), 
                'userId': user_id or None, 
                'provider': provider or None,
                'basis': 'approvedLocalDate',  # ✅ توضيح المعيار المستخدم
            },
            'counts': { 'total': counts_total, 'approved': counts_approved, 'rejected': counts_rejected },
            'totalsTRY': { 'cost': round(total_cost_usd * rate_try, 2), 'sales': round(total_sales_usd * rate_try, 2) },
            'profit': { 'try': round(profit_usd * rate_try, 2), 'usd': profit_usd, 'rateTRY': rate_try },
        })


class AdminReportsUsersView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Reports"], parameters=[OpenApiParameter(name='q', required=False, type=str), OpenApiParameter(name='limit', required=False, type=int)])
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        
        from apps.orders.models import LegacyUser
        q = (request.query_params.get('q') or '').strip()
        limit = int(request.query_params.get('limit') or 20)
        limit = max(1, min(limit, 100))
        
        # ✅ فلترة المستخدمين حسب tenant_id
        qs = LegacyUser.objects.filter(tenant_id=tenant_id)
        
        if q:
            qs = qs.filter(Q(email__icontains=q) | Q(username__icontains=q))
        
        # ترتيب حسب الأحدث
        items = list(qs.only('id','email','username').order_by('-id')[:limit])
        
        def label(u):
            # عرض اسم المستخدم فقط، أو الإيميل كبديل إذا لم يكن لديه اسم مستخدم
            username = getattr(u, 'username', None)
            email = getattr(u, 'email', None)
            return username or email or str(u.id)
        
        return Response([{ 'id': str(u.id), 'label': label(u) } for u in items])


class AdminReportsProvidersView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Reports"], responses={200: None})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        
        # جلب المزودين من جدول integrations
        from apps.providers.models import Integration
        
        providers = []
        
        # إضافة "يدوي" كخيار أول
        providers.append({ 'id': 'manual', 'label': 'يدوي' })
        
        # جلب المزودين من جدول integrations
        integrations = Integration.objects.filter(
            tenant_id=tenant_id,
            enabled=True
        ).only('id', 'name', 'provider').order_by('name')
        
        for integration in integrations:
            # استخدام الاسم إن وُجد، وإلا نوع المزود
            label = integration.name or integration.provider or str(integration.id)
            providers.append({ 
                'id': str(integration.id), 
                'label': label
            })
        
        return Response(providers)


class AdminReportsCapitalView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Reports"], responses={200: None})
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')

        rates_qs = Currency.objects.filter(tenant_id=tenant_id).order_by('code')
        rates_map: Dict[str, Decimal] = {}
        for cur in rates_qs:
            code = _normalize_currency_code(getattr(cur, 'code', None))
            rate_value = getattr(cur, 'rate', None)
            try:
                rate = Decimal(str(rate_value)) if rate_value is not None else None
            except (InvalidOperation, TypeError, ValueError):
                rate = None
            if rate and rate > 0:
                rates_map[code] = rate
        if 'USD' not in rates_map:
            rates_map['USD'] = Decimal('1')

        missing_rates: set[str] = set()

        def convert_to_usd(amount: Decimal, currency_code: str | None) -> Decimal:
            code = _normalize_currency_code(currency_code)
            rate = rates_map.get(code)
            if not rate or rate <= 0:
                if code:
                    missing_rates.add(code)
                return Decimal('0')
            if code == 'USD':
                return amount
            try:
                return amount / rate
            except (InvalidOperation, ZeroDivisionError):
                missing_rates.add(code)
                return Decimal('0')

        users_qs = (
            User.objects.filter(tenant_id=tenant_id)
            .exclude(status='disabled')
            .values('currency')
            .annotate(total=Sum('balance'), count=Count('id'))
        )

        users_totals: List[dict] = []
        users_total_usd = Decimal('0')
        users_count = 0
        for row in users_qs:
            currency = _normalize_currency_code(row.get('currency'))
            amount = _decimal_from(row.get('total'))
            usd_amount = convert_to_usd(amount, currency)
            users_total_usd += usd_amount
            users_count += int(row.get('count') or 0)
            users_totals.append({
                'currency': currency,
                'amount': _to_float(amount),
                'amountUsd': _to_float(usd_amount),
            })

        providers_qs = Integration.objects.filter(tenant_id=tenant_id, enabled=True)

        providers_items: List[dict] = []
        providers_totals_map: Dict[str, Decimal] = defaultdict(lambda: Decimal('0'))
        providers_total_usd = Decimal('0')
        for integration in providers_qs:
            amount = _decimal_from(getattr(integration, 'balance', None))
            currency = _infer_provider_currency(integration)
            usd_amount = convert_to_usd(amount, currency)
            providers_total_usd += usd_amount
            providers_totals_map[currency] += amount
            providers_items.append({
                'id': str(integration.id),
                'name': integration.name or integration.provider or str(integration.id),
                'provider': integration.provider,
                'balance': _to_float(amount),
                'currency': currency,
                'balanceUsd': _to_float(usd_amount),
                'balanceUpdatedAt': integration.balance_updated_at.isoformat() if integration.balance_updated_at else None,
            })

        providers_totals = [
            {
                'currency': code,
                'amount': _to_float(total_amount),
                'amountUsd': _to_float(convert_to_usd(total_amount, code)),
            }
            for code, total_amount in sorted(providers_totals_map.items())
        ]

        adjustments_items: List[dict] = []
        adjustments_totals_map: Dict[str, Decimal] = defaultdict(lambda: Decimal('0'))
        adjustments_total_usd = Decimal('0')
        adjustments_error: str | None = None
        try:
            adjustments_queryset = list(
                CapitalAdjustment.objects.filter(tenant_id=tenant_id).order_by('-created_at')
            )
        except ProgrammingError:
            adjustments_queryset = []
            adjustments_error = 'TABLE_MISSING'

        for adj in adjustments_queryset:
            currency = _normalize_currency_code(getattr(adj, 'currency', None))
            amount = _decimal_from(getattr(adj, 'amount', None))
            usd_amount = convert_to_usd(amount, currency)
            adjustments_total_usd += usd_amount
            adjustments_totals_map[currency] += amount
            adjustments_items.append({
                'id': str(adj.id),
                'label': getattr(adj, 'label', ''),
                'currency': currency,
                'amount': _to_float(amount),
                'amountUsd': _to_float(usd_amount),
                'note': getattr(adj, 'note', '') or '',
                'createdAt': adj.created_at.isoformat() if getattr(adj, 'created_at', None) else None,
                'updatedAt': adj.updated_at.isoformat() if getattr(adj, 'updated_at', None) else None,
            })

        adjustments_totals = [
            {
                'currency': code,
                'amount': _to_float(total_amount),
                'amountUsd': _to_float(convert_to_usd(total_amount, code)),
            }
            for code, total_amount in sorted(adjustments_totals_map.items())
        ]

        grand_total_usd = users_total_usd + providers_total_usd + adjustments_total_usd

        payload = {
            'rates': {code: _to_float(rate, places=6) for code, rate in rates_map.items()},
            'missingRates': sorted(code for code in missing_rates if code and code != 'USD'),
            'users': {
                'count': users_count,
                'totals': users_totals,
                'totalUsd': _to_float(users_total_usd),
            },
            'providers': {
                'items': providers_items,
                'totals': providers_totals,
                'totalUsd': _to_float(providers_total_usd),
            },
            'adjustments': {
                'items': adjustments_items,
                'totals': adjustments_totals,
                'totalUsd': _to_float(adjustments_total_usd),
                'error': adjustments_error,
            },
            'grandTotalUsd': _to_float(grand_total_usd),
        }

        return Response(payload)


class AdminReportsCapitalAdjustmentsView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    @extend_schema(tags=["Admin Reports"], request=CapitalAdjustmentInputSerializer, responses={201: CapitalAdjustmentSerializer})
    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        payload = CapitalAdjustmentInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        obj = CapitalAdjustment(
            tenant_id=tenant_id,
            label=data['label'],
            amount=data['amount'],
            currency=_normalize_currency_code(data.get('currency')),
            note=data.get('note') or '',
            created_by=request.user if getattr(request, 'user', None) and request.user.is_authenticated else None,
        )
        obj.save()
        return Response(CapitalAdjustmentSerializer(obj).data, status=201)


class AdminReportsCapitalAdjustmentDetailView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def _get_object(self, tenant_id: str, adj_id: str) -> CapitalAdjustment:
        try:
            return CapitalAdjustment.objects.get(id=adj_id, tenant_id=tenant_id)
        except CapitalAdjustment.DoesNotExist:
            raise NotFound('CAPITAL_ADJUSTMENT_NOT_FOUND')

    @extend_schema(tags=["Admin Reports"], request=CapitalAdjustmentInputSerializer, responses={200: CapitalAdjustmentSerializer})
    def put(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        obj = self._get_object(tenant_id, id)
        payload = CapitalAdjustmentInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        obj.label = data['label']
        obj.amount = data['amount']
        obj.currency = _normalize_currency_code(data.get('currency'))
        obj.note = data.get('note') or ''
        obj.save(update_fields=['label', 'amount', 'currency', 'note', 'updated_at'])
        return Response(CapitalAdjustmentSerializer(obj).data)

    @extend_schema(tags=["Admin Reports"], responses={204: None})
    def delete(self, request, id: str):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        obj = self._get_object(tenant_id, id)
        obj.delete()
        return Response(status=204)


class AdminReportsOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Admin Reports"],
        parameters=[
            OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER),
            OpenApiParameter(name='from', required=False, type=str, description='ISO date (YYYY-MM-DD)'),
            OpenApiParameter(name='to', required=False, type=str, description='ISO date (YYYY-MM-DD)'),
        ],
        responses={200: OverviewResponseSerializer}
    )
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        dfrom, dto = _parse_dates(request)
        # Orders: count + revenue per currency (sellPrice)
        oqs = ProductOrder.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)
        o_items = list(oqs.only('sell_price_currency','sell_price_amount'))
        orders = {
            'totalCount': oqs.count(),
            'totals': _money_totals(o_items, 'sell_price_currency', 'sell_price_amount'),
        }
        # Deposits
        dqs = Deposit.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)
        d_items = list(dqs.only('currency','amount'))
        deposits = {
            'totalCount': dqs.count(),
            'totals': _money_totals(d_items, 'currency', 'amount'),
        }
        # Payouts
        pqs = Payout.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)
        p_items = list(pqs.only('currency','amount'))
        payouts = {
            'totalCount': pqs.count(),
            'totals': _money_totals(p_items, 'currency', 'amount'),
        }
        return Response({ 'orders': orders, 'deposits': deposits, 'payouts': payouts })


class AdminReportsOverviewCSVView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(exclude=True)
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        dfrom, dto = _parse_dates(request)
        # Reuse calculations similar to JSON endpoint
        oqs = ProductOrder.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)
        o_items = list(oqs.only('sell_price_currency','sell_price_amount'))
        o_totals = _money_totals(o_items, 'sell_price_currency', 'sell_price_amount')
        dqs = Deposit.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)
        d_items = list(dqs.only('currency','amount'))
        d_totals = _money_totals(d_items, 'currency', 'amount')
        pqs = Payout.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)
        p_items = list(pqs.only('currency','amount'))
        p_totals = _money_totals(p_items, 'currency', 'amount')

        resp = HttpResponse(content_type='text/csv; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="reports_overview.csv"'
        writer = csv.writer(resp)
        writer.writerow(["section","totalCount","currency","amount","from","to"]) 
        for t in o_totals:
            writer.writerow(["orders", oqs.count(), t['currency'], t['amount'], dfrom.isoformat(), dto.isoformat()])
        for t in d_totals:
            writer.writerow(["deposits", dqs.count(), t['currency'], t['amount'], dfrom.isoformat(), dto.isoformat()])
        for t in p_totals:
            writer.writerow(["payouts", pqs.count(), t['currency'], t['amount'], dfrom.isoformat(), dto.isoformat()])
        return resp


class _DailyBase(APIView):
    permission_classes = [IsAuthenticated]
    currency_field: str = 'currency'
    amount_field: str = 'amount'
    tags: list[str] = ["Admin Reports"]

    def _get_qs(self, tenant_id, dfrom, dto):
        raise NotImplementedError

    @extend_schema(
        parameters=[
            OpenApiParameter(name='X-Tenant-Host', required=False, type=str, location=OpenApiParameter.HEADER),
            OpenApiParameter(name='from', required=False, type=str, description='ISO date (YYYY-MM-DD)'),
            OpenApiParameter(name='to', required=False, type=str, description='ISO date (YYYY-MM-DD)'),
        ],
        responses={200: DailyResponseSerializer}
    )
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        dfrom, dto = _parse_dates(request)
        qs = self._get_qs(tenant_id, dfrom, dto)
        # Group by date
        agg = qs.annotate(d=TruncDate('created_at')).values('d', self.currency_field).annotate(count=Count('id'), total=Sum(self.amount_field)).order_by('d')
        # Collect per-day totals per currency
        by_day = {}
        for row in agg:
            dt = row['d']
            cur = row[self.currency_field] or 'USD'
            total = float(row['total'] or 0)
            if dt not in by_day:
                by_day[dt] = { 'date': dt, 'count': 0, 'totals': {} }
            by_day[dt]['count'] += int(row['count'] or 0)
            by_day[dt]['totals'][cur] = round(by_day[dt]['totals'].get(cur, 0) + total, 6)
        # Transform
        items = []
        for dt in sorted(by_day.keys()):
            totals = [{ 'currency': c, 'amount': amt } for c, amt in sorted(by_day[dt]['totals'].items())]
            items.append({ 'date': dt, 'count': by_day[dt]['count'], 'totals': totals })
        return Response({ 'items': items })


class _DailyCSVBase(_DailyBase):
    @extend_schema(exclude=True)
    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        if not tenant_id:
            raise ValidationError('TENANT_ID_REQUIRED')
        dfrom, dto = _parse_dates(request)
        qs = self._get_qs(tenant_id, dfrom, dto)
        agg = qs.annotate(d=TruncDate('created_at')).values('d', self.currency_field).annotate(count=Sum('id') * 0 + Count('id'), total=Sum(self.amount_field)).order_by('d')
        # Prepare CSV
        resp = HttpResponse(content_type='text/csv; charset=utf-8')
        fname = getattr(self, 'filename', 'daily.csv')
        resp['Content-Disposition'] = f'attachment; filename="{fname}"'
        writer = csv.writer(resp)
        writer.writerow(["date","currency","amount","count","from","to"]) 
        for row in agg:
            dt = row['d']
            cur = row.get(self.currency_field) or 'USD'
            total = float(row['total'] or 0)
            cnt = int(row['count'] or 0)
            writer.writerow([dt.isoformat() if hasattr(dt,'isoformat') else str(dt), cur, round(total,6), cnt, dfrom.isoformat(), dto.isoformat()])
        return resp


class AdminOrdersDailyView(_DailyBase):
    currency_field = 'sell_price_currency'
    amount_field = 'sell_price_amount'

    @extend_schema(tags=["Admin Reports"])
    def get(self, request):
        return super().get(request)

    def _get_qs(self, tenant_id, dfrom, dto):
        return ProductOrder.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)


class AdminOrdersDailyCSVView(_DailyCSVBase):
    currency_field = 'sell_price_currency'
    amount_field = 'sell_price_amount'
    filename = 'orders_daily.csv'

    def _get_qs(self, tenant_id, dfrom, dto):
        return ProductOrder.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)


class AdminDepositsDailyView(_DailyBase):
    @extend_schema(tags=["Admin Reports"])
    def get(self, request):
        return super().get(request)

    def _get_qs(self, tenant_id, dfrom, dto):
        return Deposit.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)


class AdminDepositsDailyCSVView(_DailyCSVBase):
    filename = 'deposits_daily.csv'

    def _get_qs(self, tenant_id, dfrom, dto):
        return Deposit.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)


class AdminPayoutsDailyView(_DailyBase):
    @extend_schema(tags=["Admin Reports"])
    def get(self, request):
        return super().get(request)

    def _get_qs(self, tenant_id, dfrom, dto):
        return Payout.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)


class AdminPayoutsDailyCSVView(_DailyCSVBase):
    filename = 'payouts_daily.csv'

    def _get_qs(self, tenant_id, dfrom, dto):
        return Payout.objects.filter(tenant_id=tenant_id, created_at__date__gte=dfrom, created_at__date__lte=dto)
