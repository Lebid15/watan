from __future__ import annotations

from typing import Dict, Optional, Tuple

from rest_framework import serializers

from apps.currencies.models import Currency

from .models import User


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone_number",
            "country_code",
            "balance",
            "currency",
            "preferred_currency_code",
            "status",
            "overdraft",
            "role",
            "tenant_id",
            "price_group_id",
        ]


class UserProfileWithCurrencySerializer(UserProfileSerializer):
    currency_code = serializers.CharField(source="currency")

    class Meta(UserProfileSerializer.Meta):
        fields = UserProfileSerializer.Meta.fields + ["currency_code"]


class AdminUserSerializer(serializers.ModelSerializer):
    roleFinal = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    currencyCode = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    priceGroup = serializers.SerializerMethodField()
    isActive = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'roleFinal', 'isActive', 'balance', 'preferred_currency_code',
            'currency', 'currencyCode', 'priceGroup', 'price_group_id', 'tenant_id',
        ]

    def get_roleFinal(self, obj):
        # normalize role to lower-case string for UI
        role = getattr(obj, 'role', None)
        if not role:
            return None
        return str(role).lower()

    def _currency_cache(self) -> Dict[Tuple[str, str, str], Optional[Dict[str, object]]]:
        cache = getattr(self, '_legacy_currency_cache', None)
        if cache is None:
            cache = {}
            setattr(self, '_legacy_currency_cache', cache)
        return cache

    def _cache_key(self, obj: User) -> Tuple[str, str, str]:
        currency_id = str(getattr(obj, 'currency_id', '') or '')
        tenant_id = str(getattr(obj, 'tenant_id', '') or '')
        code = str((getattr(obj, 'preferred_currency_code', None) or getattr(obj, 'currency', None) or '')).upper()
        return (currency_id, tenant_id, code)

    def get_currency(self, obj):
        cache = self._currency_cache()
        key = self._cache_key(obj)
        if key not in cache:
            cache[key] = build_currency_payload(obj)
        return cache[key]

    def get_currencyCode(self, obj):
        currency = self.get_currency(obj)
        if currency and currency.get('code'):
            return currency['code']
        raw = getattr(obj, 'preferred_currency_code', None) or getattr(obj, 'currency', None)
        return str(raw).upper() if raw else None

    def get_balance(self, obj):
        try:
            return float(obj.balance or 0)
        except Exception:
            return 0.0

    def get_isActive(self, obj):
        status_value = getattr(obj, 'status', None)
        if status_value is not None and hasattr(User, 'Status'):
            try:
                return status_value != User.Status.DISABLED
            except Exception:
                pass
        return bool(getattr(obj, 'is_active', True))

    def get_priceGroup(self, obj):
        if getattr(obj, 'price_group_id', None):
            return {'id': obj.price_group_id}
        return None


def build_currency_payload(user: User) -> Optional[Dict[str, object]]:
    code_raw = getattr(user, 'preferred_currency_code', None) or getattr(user, 'currency', None)
    code = (str(code_raw).strip().upper() or None) if code_raw else None
    tenant_id = getattr(user, 'tenant_id', None)
    currency_obj: Optional[Currency] = None

    if code:
        qs = Currency.objects.filter(code__iexact=code)
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        currency_obj = qs.order_by('-is_primary').first()

    if currency_obj:
        return {
            'id': str(currency_obj.id),
            'code': (currency_obj.code or '').upper(),
            'name': currency_obj.name,
            'symbol': currency_obj.symbol_ar,
            'isPrimary': bool(currency_obj.is_primary),
        }

    if code:
        return {
            'id': None,
            'code': code,
            'name': None,
            'symbol': None,
            'isPrimary': None,
        }

    return None
