from __future__ import annotations

import datetime
import logging
from collections import deque
from dataclasses import dataclass
import json
import uuid
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Optional, Any, Dict

from django.conf import settings
from django.db import transaction, connection
from django.db.models import Q
from django.utils import timezone

from .models import ProductOrder
from apps.users.legacy_models import LegacyUser
from apps.users.models import User as DjangoUser

logger = logging.getLogger(__name__)


class OrderStatusError(Exception):
    """Base exception for order status transitions."""


class OrderNotFoundError(OrderStatusError):
    """Raised when the order is missing."""


class TenantMismatchError(OrderStatusError):
    """Raised when an order does not belong to the expected tenant."""


class LegacyUserMissingError(OrderStatusError):
    """Raised when the legacy user linked to the order cannot be resolved."""


class OverdraftExceededError(OrderStatusError):
    """Raised when trying to charge beyond the allowed overdraft."""


@dataclass
class OrderStatusChange:
    order: ProductOrder
    previous_status: str
    delta_amount_user_currency: Decimal
    django_user_updated: bool


class CostComputationError(Exception):
    """Raised when cost or FX data cannot be resolved under enforcement."""


@dataclass
class CostSnapshot:
    source: str
    unit_cost_usd: Decimal
    original_amount: Decimal | None
    original_currency: str | None
    fx_rate: Decimal | None = None

    def as_log_payload(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "unit_cost_usd": str(self.unit_cost_usd),
            "original_amount": str(self.original_amount) if self.original_amount is not None else None,
            "original_currency": self.original_currency,
            "fx_rate": str(self.fx_rate) if self.fx_rate is not None else None,
        }


LEGACY_QUANT = Decimal("0.01")
DJANGO_QUANT = Decimal("0.000001")


def _usd_enforcement_enabled() -> bool:
    return bool(getattr(settings, "FF_USD_COST_ENFORCEMENT", False))


def _prepare_log_payload(payload: Any) -> Any:
    if payload is None:
        return None

    if isinstance(payload, Decimal):
        return str(payload)
    if isinstance(payload, dict):
        return {key: _prepare_log_payload(value) for key, value in payload.items()}
    if isinstance(payload, (list, tuple)):
        return [_prepare_log_payload(item) for item in payload]
    return payload


def _write_dispatch_log(order_id: uuid.UUID | str, *, action: str, result: str | None = None, message: str | None = None, payload: Any = None) -> None:
    if not (_usd_enforcement_enabled() or _auto_fallback_enabled()):
        return

    try:
        payload_serialized = json.dumps(_prepare_log_payload(payload)) if payload is not None else None
    except Exception:
        payload_serialized = None

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO order_dispatch_log (order_id, action, result, message, payload_snapshot)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [str(order_id), action, result, message, payload_serialized],
            )
    except Exception as exc:  # pragma: no cover - logging only
        logger.warning(
            "Failed to write dispatch log",
            extra={"order_id": str(order_id), "action": action, "error": str(exc)},
        )


def _fetch_currency_rate(tenant_id, currency_code: str) -> Decimal:
    from apps.currencies.models import Currency

    code = (currency_code or "USD").upper()
    if code == "USD":
        return Decimal("1")

    row = Currency.objects.filter(tenant_id=tenant_id, code__iexact=code, is_active=True).first()
    rate_raw = getattr(row, "rate", None)
    try:
        rate = Decimal(str(rate_raw)) if rate_raw is not None else Decimal("0")
    except (InvalidOperation, TypeError, ValueError):
        rate = Decimal("0")

    if rate <= 0:
        raise CostComputationError(f"FX_RATE_MISSING:{code}")
    return rate


def _convert_to_usd(amount: Decimal, currency_code: str, tenant_id) -> tuple[Decimal, Decimal | None]:
    code = _normalize_currency_code(currency_code, "USD")
    if code == "USD":
        return amount, Decimal("1")

    rate = _fetch_currency_rate(tenant_id, code)
    if rate <= 0:
        raise CostComputationError(f"FX_RATE_INVALID:{code}")
    usd_value = amount / rate
    return usd_value, rate


def _persist_cost_snapshot(
    *,
    order_id: uuid.UUID | str,
    snapshot: CostSnapshot,
    quantity: int,
    tenant_id,
    mode: str | None = None,
) -> None:
    total_cost_usd = snapshot.unit_cost_usd * Decimal(quantity)
    
    # PATCH 5.x: Calculate TRY snapshots using the FX rate
    # If we have a TRY original amount and rate, use those
    # Otherwise fetch the current TRY rate to compute TRY snapshots
    cost_try_at_order = None
    fx_rate_to_use = snapshot.fx_rate
    
    if snapshot.original_currency == "TRY" and snapshot.original_amount is not None:
        # Provider gave us TRY directly
        cost_try_at_order = snapshot.original_amount * Decimal(quantity)
    elif fx_rate_to_use is not None and fx_rate_to_use > 0:
        # We have an FX rate, compute TRY equivalent
        cost_try_at_order = total_cost_usd * fx_rate_to_use
    else:
        # Fetch current TRY rate
        try:
            try_rate = _fetch_currency_rate(tenant_id, "TRY")
            cost_try_at_order = total_cost_usd * try_rate
            fx_rate_to_use = try_rate
        except CostComputationError:
            # No TRY rate available, leave TRY fields null
            pass
    
    params = [
        float(snapshot.unit_cost_usd),
        snapshot.source,
        float(total_cost_usd),
        "USD",  # costCurrency is always USD for cost_price_usd
        float(total_cost_usd),  # costAmount in USD
        str(order_id),
    ]

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE product_orders
                SET cost_price_usd = %s,
                    cost_source = %s,
                    cost_usd_at_order = %s,
                    "costCurrency" = %s,
                    "costAmount" = %s
                WHERE id = %s
                """,
                params,
            )
            
            # PATCH 5.x: Also update TRY snapshots if we have them
            if cost_try_at_order is not None and fx_rate_to_use is not None:
                cursor.execute(
                    """
                    UPDATE product_orders
                    SET cost_try_at_order = %s,
                        fx_usd_try_at_order = %s
                    WHERE id = %s
                    """,
                    [float(cost_try_at_order), float(fx_rate_to_use), str(order_id)],
                )
    except Exception as exc:
        logger.warning(
            "Failed to persist cost snapshot",
            extra={"order_id": str(order_id), "error": str(exc)},
        )

    if mode:
        try:
            with connection.cursor() as cursor:
                # Don't overwrite MANUAL mode (set when no routing exists)
                cursor.execute(
                    "UPDATE product_orders SET mode = %s WHERE id = %s AND (mode IS NULL OR mode != 'MANUAL')",
                    [mode, str(order_id)],
                )
        except Exception:
            pass


def _ensure_sell_snapshot(order: ProductOrder, *, sell_usd: Decimal, fx_rate: Decimal | None = None) -> None:
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE product_orders
                SET sell_usd_at_order = %s,
                    fx_usd_try_at_order = COALESCE(%s, fx_usd_try_at_order)
                WHERE id = %s
                """,
                [float(sell_usd), float(fx_rate or 1), str(order.id)],
            )
    except Exception as exc:
        logger.warning(
            "Failed to persist sell snapshot",
            extra={"order_id": str(order.id), "error": str(exc)},
        )

    setattr(order, "sell_usd_at_order", sell_usd)
    if fx_rate is not None:
        setattr(order, "fx_usd_try_at_order", fx_rate)


def _compute_cost_snapshot_enforced(
    order: ProductOrder,
    *,
    tenant_id,
    provider_id,
    provider_response: Dict[str, Any] | None,
) -> CostSnapshot:
    quantity = max(int(order.quantity or 1), 1)

    # 1. Provider supplied cost
    if provider_response:
        provider_cost = provider_response.get("cost")
        provider_currency = provider_response.get("costCurrency") or provider_response.get("currency")
        
        if provider_cost not in (None, ""):
            try:
                raw_amount = Decimal(str(provider_cost))
            except (InvalidOperation, TypeError, ValueError):
                raw_amount = None

            if raw_amount is not None and raw_amount > 0:
                # PATCH 5.x: Properly detect and convert provider currency to USD
                # The provider may return TRY or other currency - we must convert it
                currency = _normalize_currency_code(provider_currency, "USD")
                
                # If currency is TRY or any non-USD currency, convert to USD using FX rate
                if currency == "USD":
                    usd_value = raw_amount
                    rate = Decimal("1")
                else:
                    # Convert to USD using the currency table
                    usd_value, rate = _convert_to_usd(raw_amount, currency, tenant_id)
                
                return CostSnapshot(
                    source="provider_response",
                    unit_cost_usd=usd_value,
                    original_amount=raw_amount,
                    original_currency=currency,
                    fx_rate=rate,
                )

    # 2. PackageCost for provider/package
    try:
        from apps.providers.models import PackageCost

        pkg_cost = PackageCost.objects.get(
            tenant_id=tenant_id,
            package_id=order.package_id,
            provider_id=provider_id,
        )
        raw_amount = Decimal(str(pkg_cost.cost_amount or 0))
        if raw_amount > 0:
            currency = _normalize_currency_code(getattr(pkg_cost, "cost_currency", None), "USD")
            usd_value, rate = _convert_to_usd(raw_amount, currency, tenant_id)
            return CostSnapshot(
                source="package_cost",
                unit_cost_usd=usd_value,
                original_amount=raw_amount,
                original_currency=currency,
                fx_rate=rate,
            )
    except PackageCost.DoesNotExist:
        pass

    # 3. Package base price fallback
    from apps.products.models import ProductPackage

    try:
        pkg = ProductPackage.objects.get(id=order.package_id, tenant_id=tenant_id)
    except ProductPackage.DoesNotExist as exc:
        raise CostComputationError("PACKAGE_COST_UNAVAILABLE") from exc

    raw_base = Decimal(str(pkg.base_price or pkg.capital or 0))
    if raw_base <= 0:
        raise CostComputationError("BASE_PRICE_UNAVAILABLE")

    return CostSnapshot(
        source="package_base_price",
        unit_cost_usd=raw_base,
        original_amount=raw_base,
        original_currency="USD",
        fx_rate=Decimal("1"),
    )


def _compute_manual_cost_snapshot(order: ProductOrder) -> CostSnapshot:
    """
    Compute cost snapshot for manual orders using tenant's PriceGroup USD value directly.
    
    For manual orders:
    - cost_price_usd = tenant's PriceGroup USD value directly
    - No currency conversion or multiplication by TRY
    - Use PackagePrice.unit_price (USD) from PriceGroup, not base_price/capital
    """
    tenant_id = getattr(order, "tenant_id", None)
    if not tenant_id:
        raise CostComputationError("TENANT_MISSING")

    from apps.products.models import ProductPackage, PackagePrice
    from apps.users.legacy_models import LegacyUser

    pkg = ProductPackage.objects.filter(id=order.package_id, tenant_id=tenant_id).first()
    if pkg is None:
        raise CostComputationError("PACKAGE_NOT_FOUND")

    legacy_user = LegacyUser.objects.filter(id=order.user_id, tenant_id=tenant_id).first()
    price_group_id = getattr(legacy_user, "price_group_id", None)

    # Find PriceGroup-specific pricing first
    price_row = None
    if price_group_id:
        price_row = PackagePrice.objects.filter(
            tenant_id=tenant_id,
            package_id=pkg.id,
            price_group_id=price_group_id,
        ).first()
    
    # Fallback to default pricing if no PriceGroup-specific pricing
    if price_row is None:
        price_row = PackagePrice.objects.filter(tenant_id=tenant_id, package_id=pkg.id).first()

    # For manual orders, use PriceGroup USD value directly (unit_price in USD)
    # This is the tenant's PriceGroup USD value - no conversion needed
    if price_row and hasattr(price_row, 'unit_price') and price_row.unit_price is not None:
        candidate = price_row.unit_price
    else:
        # Fallback to package base_price/capital if no PackagePrice found
        candidate = pkg.base_price or pkg.capital or 0

    try:
        unit_cost = Decimal(str(candidate))
    except (InvalidOperation, TypeError, ValueError):
        unit_cost = Decimal("0")

    if unit_cost <= 0:
        raise CostComputationError("MANUAL_COST_UNAVAILABLE")

    return CostSnapshot(
        source="manual_price_group_usd",
        unit_cost_usd=unit_cost,
        original_amount=unit_cost,
        original_currency="USD",
        fx_rate=Decimal("1"),  # No FX conversion for manual orders
    )


def _as_decimal(value: object) -> Decimal:
    try:
        return Decimal(value)
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def _normalize_currency_code(code: Optional[str], default: str = "USD") -> str:
    normalized = (str(code).strip().upper()) if code else ""
    return normalized or default


def _chain_propagation_enabled() -> bool:
    return bool(getattr(settings, "FF_CHAIN_STATUS_PROPAGATION", False))


def _auto_fallback_enabled() -> bool:
    return bool(getattr(settings, "FF_AUTO_FALLBACK_ROUTING", False))


FALLBACK_NOTE_PREFIX = "AUTO_FALLBACK:"


def _classify_fallback_reason(*, status: Optional[str], note: Optional[str], error: Optional[str]) -> Optional[str]:
    parts: list[str] = []
    for value in (status, note, error):
        if not value:
            continue
        text = str(value).strip()
        if text:
            parts.append(text)
    if not parts:
        return None

    haystack = " ".join(parts).lower()
    balance_keywords = (
        "insufficient balance",
        "not enough balance",
        "no balance",
        "balance yetersiz",
        "bakiye yetersiz",
        "yetersiz bakiye",
        "bakiye yok",
    )
    if any(keyword in haystack for keyword in balance_keywords):
        return "no_balance"

    unavailable_keywords = (
        "service unavailable",
        "provider unavailable",
        "temporarily unavailable",
        "maintenance",
        "bakim",
        "bakım",
        "offline",
        "kapali",
        "kapalı",
        "out of stock",
        "stok yok",
        "not available",
        "unavailable",
    )
    if any(keyword in haystack for keyword in unavailable_keywords):
        return "unavailable"

    return None


def _append_system_note(order: ProductOrder, text: str) -> None:
    entry = {"by": "system", "text": text, "at": timezone.now().isoformat()}
    notes = list(order.notes or [])
    notes.append(entry)
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE product_orders
                SET notes = %s,
                    "notesCount" = %s
                WHERE id = %s
                """,
                [json.dumps(notes), len(notes), str(order.id)],
            )
    except Exception as exc:  # pragma: no cover - defensive logging only
        logger.warning(
            "Failed to append system note",
            extra={"order_id": str(order.id), "error": str(exc)},
        )
    else:
        order.notes = notes


def _has_fallback_marker(order: ProductOrder, provider_id: str) -> bool:
    marker = f"{FALLBACK_NOTE_PREFIX}{provider_id}"
    for note in order.notes or []:
        if isinstance(note, dict):
            text = str(note.get("text", ""))
        else:
            text = str(note)
        if marker in text:
            return True
    return False


def _mark_fallback_attempt(*, order: ProductOrder, from_provider: str, to_provider: str, reason: str) -> None:
    marker = f"{FALLBACK_NOTE_PREFIX}{to_provider}"
    note_text = f"{marker} from={from_provider} reason={reason}"
    _append_system_note(order, note_text)


def _log_fallback_event(
    order_id: uuid.UUID | str,
    *,
    from_provider: Optional[str],
    to_provider: str,
    stage: str,
    reason: Optional[str] = None,
    message: Optional[str] = None,
    payload: Any = None,
) -> None:
    log_payload = {
        "from_provider": from_provider,
        "to_provider": to_provider,
        "reason": reason,
        "stage": stage,
        "details": _prepare_log_payload(payload),
    }
    _write_dispatch_log(order_id, action="FALLBACK", result=stage, message=message, payload=log_payload)


def _safe_uuid(value: object) -> str | None:
    if value in (None, ""):
        return None
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def _write_chain_log(
    order_id: uuid.UUID | str,
    *,
    action: str,
    result: str | None = None,
    message: str | None = None,
    payload: Any = None,
) -> None:
    if not _chain_propagation_enabled():
        return

    try:
        payload_serialized = json.dumps(_prepare_log_payload(payload)) if payload is not None else None
    except Exception:
        payload_serialized = None

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO order_dispatch_log (order_id, action, result, message, payload_snapshot)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [str(order_id), action, result, message, payload_serialized],
            )
    except Exception as exc:  # pragma: no cover - logging only
        logger.warning(
            "Failed to write chain log",
            extra={"order_id": str(order_id), "action": action, "error": str(exc)},
        )


def _discover_chain_links(order: ProductOrder) -> list[ProductOrder]:
    own_id = str(order.id)
    candidate_ids: list[str] = []

    for attr in ("root_order_id", "external_order_id", "provider_referans"):
        candidate = _safe_uuid(getattr(order, attr, None))
        if candidate and candidate != own_id:
            candidate_ids.append(candidate)

    related_qs = ProductOrder.objects.filter(
        Q(root_order_id=own_id) | Q(external_order_id=own_id) | Q(provider_referans=own_id)
    ).values_list("id", flat=True)

    for pk in related_qs:
        pk_str = str(pk)
        if pk_str != own_id:
            candidate_ids.append(pk_str)

    unique_ids = list(dict.fromkeys(candidate_ids))
    if not unique_ids:
        return []

    return list(ProductOrder.objects.filter(id__in=unique_ids))


def _collect_chain_reference_ids(order: ProductOrder) -> set[str]:
    refs: set[str] = set()
    for attr in ("root_order_id", "external_order_id", "provider_referans"):
        ref = _safe_uuid(getattr(order, attr, None))
        if ref:
            refs.add(ref)
    return refs


def _chain_relation(source: ProductOrder, neighbor: ProductOrder) -> str:
    """Determine direction of propagation between two linked orders."""
    source_id = str(source.id)
    neighbor_id = str(neighbor.id)

    neighbor_refs = _collect_chain_reference_ids(neighbor)
    if source_id in neighbor_refs:
        return "upstream"

    source_refs = _collect_chain_reference_ids(source)
    if neighbor_id in source_refs:
        return "downstream"

    return "peer"


def _update_wallet_for_chain_status_change(
    *,
    order: ProductOrder,
    new_status: str,
    prev_status: str,
) -> None:
    """
    Update wallet balance when order status changes in chain propagation.
    This ensures that all orders in the chain have their wallets updated correctly.
    """
    logger.info(
        "Chain wallet update started",
        extra={
            "order_id": str(order.id),
            "new_status": new_status,
            "prev_status": prev_status,
            "user_id": str(order.user_id),
            "user_identifier": order.user_identifier,
        }
    )
    
    try:
        legacy_user = LegacyUser.objects.select_for_update().get(
            id=order.user_id,
            tenant_id=order.tenant_id,
        )
    except LegacyUser.DoesNotExist:
        logger.warning(
            "Chain wallet update: LegacyUser not found",
            extra={"order_id": str(order.id), "user_id": str(order.user_id)}
        )
        return
    
    django_user = _resolve_django_user_for_update(legacy_user, order.tenant_id)
    
    amount_user = order.sell_price_amount if order.sell_price_amount not in (None, "") else order.price
    amount_user_dec = _quantize(_as_decimal(amount_user), LEGACY_QUANT)
    legacy_balance = _quantize(_as_decimal(getattr(legacy_user, "balance", 0)), LEGACY_QUANT)
    django_balance = _quantize(_as_decimal(getattr(django_user, "balance", 0) if django_user else 0), DJANGO_QUANT)
    
    # Rejected: Return money
    if new_status == "rejected" and prev_status != "rejected":
        new_legacy_balance = _quantize(legacy_balance + amount_user_dec, LEGACY_QUANT)
        
        logger.info(
            "Chain wallet update: Refunding money",
            extra={
                "order_id": str(order.id),
                "amount": str(amount_user_dec),
                "old_balance": str(legacy_balance),
                "new_balance": str(new_legacy_balance),
                "user_identifier": order.user_identifier,
            }
        )
        
        legacy_user.balance = new_legacy_balance
        legacy_user.save(update_fields=["balance"])
        
        if django_user is not None:
            new_django_balance = _quantize(django_balance + _quantize(amount_user_dec, DJANGO_QUANT), DJANGO_QUANT)
            django_user.balance = new_django_balance
            django_user.save(update_fields=["balance"])
            
            # Record wallet transaction
            from apps.users.wallet_helpers import record_wallet_transaction
            from apps.users.models import User
            try:
                locked_user = User.objects.select_for_update().get(id=django_user.id)
                current_balance = _quantize(_as_decimal(locked_user.balance), DJANGO_QUANT)
                
                package_name = getattr(order.package, 'name', 'باقة غير معروفة') if hasattr(order, 'package') and order.package else 'باقة غير معروفة'
                user_identifier = order.user_identifier or ''
                order_short_id = str(order.id)[:8]
                
                description = f"رفض الطلب (سلسلة) ({order_short_id})\n{package_name}"
                if user_identifier:
                    description += f" - ID: {user_identifier}"
                
                balance_after = current_balance
                balance_before = current_balance - _quantize(amount_user_dec, DJANGO_QUANT)
                
                record_wallet_transaction(
                    user=locked_user,
                    transaction_type='rejected',
                    amount=amount_user_dec,
                    description=description,
                    order_id=str(order.id),
                    balance_before=balance_before,
                    metadata={
                        'order_status': 'rejected',
                        'previous_status': prev_status,
                        'package_name': package_name,
                        'user_identifier': user_identifier,
                        'chain_propagation': True,
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to record chain wallet transaction: {e}")
    
    # Approved after rejected: Deduct money again
    elif new_status == "approved" and prev_status == "rejected":
        overdraft_legacy = _quantize(_as_decimal(getattr(legacy_user, "overdraft_limit", 0)), LEGACY_QUANT)
        proposed_legacy_balance = legacy_balance - amount_user_dec
        if proposed_legacy_balance < -overdraft_legacy:
            logger.warning(
                "Chain wallet update: Overdraft exceeded",
                extra={"order_id": str(order.id), "balance": str(legacy_balance), "amount": str(amount_user_dec)}
            )
            return
        
        legacy_user.balance = _quantize(proposed_legacy_balance, LEGACY_QUANT)
        legacy_user.save(update_fields=["balance"])
        
        if django_user is not None:
            overdraft_django = _quantize(_as_decimal(getattr(django_user, "overdraft", 0)), DJANGO_QUANT)
            proposed_django_balance = django_balance - _quantize(amount_user_dec, DJANGO_QUANT)
            if proposed_django_balance < -overdraft_django:
                logger.warning(
                    "Chain wallet update: Django overdraft exceeded",
                    extra={"order_id": str(order.id), "balance": str(django_balance), "amount": str(amount_user_dec)}
                )
                return
            
            django_user.balance = _quantize(proposed_django_balance, DJANGO_QUANT)
            django_user.save(update_fields=["balance"])
            
            # Record wallet transaction
            from apps.users.wallet_helpers import record_wallet_transaction
            from apps.users.models import User
            try:
                locked_user = User.objects.select_for_update().get(id=django_user.id)
                current_balance = _quantize(_as_decimal(locked_user.balance), DJANGO_QUANT)
                
                package_name = getattr(order.package, 'name', 'باقة غير معروفة') if hasattr(order, 'package') and order.package else 'باقة غير معروفة'
                user_identifier = order.user_identifier or ''
                order_short_id = str(order.id)[:8]
                
                description = f"تغيير الحالة إلى قبول (سلسلة) ({order_short_id})\n{package_name}"
                if user_identifier:
                    description += f" - ID: {user_identifier}"
                
                balance_after = current_balance
                balance_before = current_balance + _quantize(amount_user_dec, DJANGO_QUANT)
                
                record_wallet_transaction(
                    user=locked_user,
                    transaction_type='status_change',
                    amount=amount_user_dec,
                    description=description,
                    order_id=str(order.id),
                    balance_before=balance_before,
                    metadata={
                        'order_status': 'approved',
                        'previous_status': prev_status,
                        'package_name': package_name,
                        'user_identifier': user_identifier,
                        'chain_propagation': True,
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to record chain wallet transaction: {e}")


def _apply_chain_updates(
    *,
    target: ProductOrder,
    source: ProductOrder,
    note_override: Optional[str],
    relation: str,
) -> tuple[list[str], dict[str, Any], dict[str, Any]]:
    updated_fields: list[str] = []
    prev_snapshot = {
        "status": getattr(target, "status", None),
        "external_status": getattr(target, "external_status", None),
        "provider_id": getattr(target, "provider_id", None),
        "manual_note": getattr(target, "manual_note", None),
        "provider_message": getattr(target, "provider_message", None),
        "last_message": getattr(target, "last_message", None),
        "pin_code": getattr(target, "pin_code", None),
        "cost_price_usd": getattr(target, "cost_price_usd", None),
        "cost_try_at_order": getattr(target, "cost_try_at_order", None),
        "cost_source": getattr(target, "cost_source", None),
    }

    propagate_status = relation != "downstream"
    propagate_provider_details = relation != "downstream"

    child_status = getattr(source, "status", None)
    prev_target_status = getattr(target, "status", None)
    if propagate_status and child_status and prev_target_status != child_status:
        target.status = child_status
        updated_fields.append("status")
        
        # WALLET UPDATE: Update wallet balance when status changes in chain
        if child_status in ('approved', 'rejected') and prev_target_status != child_status:
            try:
                _update_wallet_for_chain_status_change(
                    order=target,
                    new_status=child_status,
                    prev_status=prev_target_status or 'pending'
                )
            except Exception as exc:
                logger.warning(
                    "Failed to update wallet for chain status change",
                    extra={
                        "order_id": str(target.id),
                        "new_status": child_status,
                        "prev_status": prev_target_status,
                        "error": str(exc)
                    }
                )

    child_external_status = getattr(source, "external_status", None)
    if propagate_status and child_external_status and getattr(target, "external_status", None) != child_external_status:
        target.external_status = child_external_status
        updated_fields.append("external_status")

    child_provider_id = getattr(source, "provider_id", None)
    if propagate_provider_details and child_provider_id and getattr(target, "provider_id", None) != child_provider_id:
        target.provider_id = child_provider_id
        updated_fields.append("provider_id")

    child_completed_at = getattr(source, "completed_at", None)
    if propagate_status and child_completed_at and getattr(target, "completed_at", None) != child_completed_at:
        target.completed_at = child_completed_at
        updated_fields.append("completed_at")

    child_last_sync = getattr(source, "last_sync_at", None)
    if propagate_status and child_last_sync and getattr(target, "last_sync_at", None) != child_last_sync:
        target.last_sync_at = child_last_sync
        updated_fields.append("last_sync_at")

    child_duration = getattr(source, "duration_ms", None)
    if propagate_status and child_duration is not None and getattr(target, "duration_ms", None) != child_duration:
        target.duration_ms = child_duration
        updated_fields.append("duration_ms")

    child_pin_code = getattr(source, "pin_code", None)
    if propagate_provider_details and child_pin_code and getattr(target, "pin_code", None) != child_pin_code:
        target.pin_code = child_pin_code
        updated_fields.append("pin_code")

    child_provider_message = getattr(source, "provider_message", None)
    if propagate_provider_details and child_provider_message and getattr(target, "provider_message", None) != child_provider_message:
        target.provider_message = child_provider_message
        updated_fields.append("provider_message")

    child_last_message = getattr(source, "last_message", None)
    if propagate_provider_details and child_last_message and getattr(target, "last_message", None) != child_last_message:
        target.last_message = child_last_message
        updated_fields.append("last_message")

    note_value = (note_override or getattr(source, "manual_note", None) or "").strip()
    if note_value:
        target_note_existing = (getattr(target, "manual_note", None) or "").strip()
        if target_note_existing != note_value:
            target.manual_note = note_value
            updated_fields.append("manual_note")

    if propagate_status and getattr(source, "status", None) == "approved":
        for attr in ("approved_at", "approved_local_date", "approved_local_month"):
            child_value = getattr(source, attr, None)
            if child_value and getattr(target, attr, None) != child_value:
                setattr(target, attr, child_value)
                updated_fields.append(attr)
        if getattr(source, "fx_locked", False) and not getattr(target, "fx_locked", False):
            target.fx_locked = True
            updated_fields.append("fx_locked")

    # CHAIN COST PROPAGATION: Propagate cost information from child to parent
    child_cost_price_usd = getattr(source, "cost_price_usd", None)
    if child_cost_price_usd is not None and getattr(target, "cost_price_usd", None) != child_cost_price_usd:
        target.cost_price_usd = child_cost_price_usd
        updated_fields.append("cost_price_usd")

    child_cost_try_at_order = getattr(source, "cost_try_at_order", None)
    if child_cost_try_at_order is not None and getattr(target, "cost_try_at_order", None) != child_cost_try_at_order:
        target.cost_try_at_order = child_cost_try_at_order
        updated_fields.append("cost_try_at_order")

    child_cost_source = getattr(source, "cost_source", None)
    if child_cost_source and getattr(target, "cost_source", None) != child_cost_source:
        target.cost_source = child_cost_source
        updated_fields.append("cost_source")

    # CHAIN PATH: Update chain path when propagating status
    child_chain_path = getattr(source, "chain_path", None)
    if child_chain_path and getattr(target, "chain_path", None) != child_chain_path:
        target.chain_path = child_chain_path
        updated_fields.append("chain_path")

    next_snapshot = {
        "status": getattr(target, "status", None),
        "external_status": getattr(target, "external_status", None),
        "provider_id": getattr(target, "provider_id", None),
        "manual_note": getattr(target, "manual_note", None),
        "provider_message": getattr(target, "provider_message", None),
        "last_message": getattr(target, "last_message", None),
        "pin_code": getattr(target, "pin_code", None),
        "cost_price_usd": getattr(target, "cost_price_usd", None),
        "cost_try_at_order": getattr(target, "cost_try_at_order", None),
        "cost_source": getattr(target, "cost_source", None),
        "chain_path": getattr(target, "chain_path", None),
    }

    return updated_fields, prev_snapshot, next_snapshot


def _propagate_chain_status(
    order: ProductOrder,
    *,
    origin: str,
    manual_note: Optional[str] = None,
) -> None:
    if not _chain_propagation_enabled():
        return

    visited: set[str] = {str(order.id)}
    queue: deque[ProductOrder] = deque([order])
    note_override = manual_note or getattr(order, "manual_note", None)

    while queue:
        current = queue.popleft()
        for neighbor in _discover_chain_links(current):
            neighbor_id = str(neighbor.id)
            if neighbor_id in visited:
                continue
            visited.add(neighbor_id)

            relation = _chain_relation(current, neighbor)
            updated_fields, prev_snapshot, next_snapshot = _apply_chain_updates(
                target=neighbor,
                source=order,
                note_override=note_override,
                relation=relation,
            )

            if updated_fields:
                unique_fields = list(dict.fromkeys(updated_fields))
                try:
                    neighbor.save(update_fields=unique_fields)
                except Exception:
                    neighbor.save()

                _write_chain_log(
                    neighbor.id,
                    action="CHAIN_STATUS",
                    result="success",
                    payload={
                        "origin": origin,
                        "source_order_id": str(order.id),
                        "updated_fields": unique_fields,
                        "previous": prev_snapshot,
                        "next": next_snapshot,
                    },
                )

            queue.append(neighbor)


def _create_chain_forward_order(
    source_order: ProductOrder,
    target_tenant_id: str,
    target_package_id: str,
    target_user_id: str,
) -> Optional[ProductOrder]:
    """
    إنشاء طلب جديد في المستأجر التالي للتوجيه متعدد المراحل.
    
    Args:
        source_order: الطلب المصدر
        target_tenant_id: معرّف المستأجر الهدف
        target_package_id: معرّف الباقة في المستأجر الهدف
        target_user_id: معرّف المستخدم في المستأجر الهدف
        
    Returns:
        الطلب الجديد المُنشأ أو None في حالة الفشل
    """
    try:
        print(f"\n[REFRESH] Creating chain forward order...")
        print(f"   Source Order: {source_order.id}")
        print(f"   Target Tenant: {target_tenant_id}")
        print(f"   Target Package: {target_package_id}")
        print(f"   Target User: {target_user_id}")
        
        # إنشاء الطلب الجديد
        new_order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=target_tenant_id,
            user_id=target_user_id,
            product_id=source_order.product_id,  # نفس المنتج
            package_id=target_package_id,  # الباقة في المستأجر الجديد
            quantity=source_order.quantity,
            status='pending',
            price=source_order.price,  # نفس السعر
            sell_price_currency=source_order.sell_price_currency,
            sell_price_amount=source_order.sell_price_amount,
            created_at=timezone.now(),
            user_identifier=source_order.user_identifier,
            extra_field=source_order.extra_field,
            notes=[],
            notes_count=0,
            # إعدادات التوجيه متعدد المراحل
            root_order_id=source_order.root_order_id or source_order.id,
            mode='CHAIN_FORWARD',
            external_order_id=f"stub-{source_order.id}",  # علامة التوجيه
            chain_path=source_order.chain_path or [str(source_order.id)],
        )
        
        print(f"   [OK] Chain forward order created: {new_order.id}")
        print(f"   - Root Order: {new_order.root_order_id}")
        print(f"   - Chain Path: {new_order.chain_path}")
        print(f"   - External Order ID: {new_order.external_order_id}")
        
        return new_order
        
    except Exception as exc:
        print(f"   [ERROR] Failed to create chain forward order: {exc}")
        logger.error(
            "Failed to create chain forward order",
            extra={
                "source_order_id": str(source_order.id),
                "target_tenant_id": target_tenant_id,
                "target_package_id": target_package_id,
                "error": str(exc)
            }
        )
        return None


def _determine_next_tenant_in_chain(
    current_tenant_id: str,
    package_id: str,
) -> Optional[tuple[str, str, str]]:
    """
    تحديد المستأجر التالي في السلسلة بناءً على إعدادات التوجيه.
    
    Args:
        current_tenant_id: معرّف المستأجر الحالي
        package_id: معرّف الباقة
        
    Returns:
        tuple (target_tenant_id, target_package_id, target_user_id) أو None
    """
    try:
        print(f"\n[SEARCH] Determining next tenant in chain...")
        print(f"   Current Tenant: {current_tenant_id}")
        print(f"   Package ID: {package_id}")
        
        # خريطة التوجيه الثابتة (معطلة حالياً - يتم التوجيه المباشر إلى المزود بدلاً من ذلك)
        # DISABLED: Chain forwarding is now handled differently for manual routing
        chain_mapping = {
            # Al-Sham → ShamTech (Diana) - DISABLED
            # "7d37f00a-22f3-4e61-88d7-2a97b79d86fb": {  # Al-Sham tenant ID
            #     "target_tenant": "7d677574-21be-45f7-b520-22e0fe36b860",  # ShamTech tenant ID
            #     "target_package": "same",  # نفس الباقة
            #     "target_user": "7a73edd8-183f-4fbd-a07b-6863b3f6b842",  # مستخدم موجود
            # },
            # يمكن إضافة المزيد من التوجيهات هنا
        }
        
        # البحث عن التوجيه المناسب
        if current_tenant_id in chain_mapping:
            config = chain_mapping[current_tenant_id]
            target_tenant_id = config["target_tenant"]
            target_package_id = package_id if config["target_package"] == "same" else config["target_package"]
            target_user_id = config["target_user"]
            
            print(f"   [OK] Found chain mapping:")
            print(f"   - Target Tenant: {target_tenant_id}")
            print(f"   - Target Package: {target_package_id}")
            print(f"   - Target User: {target_user_id}")
            
            return (target_tenant_id, target_package_id, target_user_id)
        
        print(f"   [WARNING] No chain mapping found for tenant: {current_tenant_id}")
        return None
        
    except Exception as exc:
        print(f"   [ERROR] Error determining next tenant: {exc}")
        logger.error(
            "Failed to determine next tenant in chain",
            extra={
                "current_tenant_id": current_tenant_id,
                "package_id": package_id,
                "error": str(exc)
            }
        )
        return None


def _propagate_forward_completion(child_order: ProductOrder, manual_note: Optional[str]) -> None:
    """Ensure forwarded source orders receive the same completion data."""
    if _chain_propagation_enabled():
        try:
            _propagate_chain_status(child_order, origin="forward_completion", manual_note=manual_note)
        except Exception:
            logger.exception(
                "Chain status propagation failed",
                extra={"order_id": str(child_order.id), "origin": "forward_completion"},
            )
        return

    candidate_ids: list[str] = []
    for candidate in (getattr(child_order, "external_order_id", None), getattr(child_order, "provider_referans", None)):
        if not candidate:
            continue
        try:
            candidate_uuid = uuid.UUID(str(candidate))
        except (ValueError, TypeError, AttributeError):
            continue
        candidate_str = str(candidate_uuid)
        if candidate_str == str(child_order.id):
            continue
        candidate_ids.append(candidate_str)

    if not candidate_ids:
        return

    for source_id in dict.fromkeys(candidate_ids):  # preserve order, deduplicate
        try:
            source_order = ProductOrder.objects.get(id=source_id)
        except ProductOrder.DoesNotExist:
            continue

        updated_fields: list[str] = []
        if manual_note and source_order.manual_note != manual_note:
            source_order.manual_note = manual_note
            updated_fields.append("manual_note")

        if source_order.status != "approved":
            source_order.status = "approved"
            updated_fields.append("status")

        child_provider_id = getattr(child_order, "provider_id", None)
        if child_provider_id and source_order.provider_id != child_provider_id:
            source_order.provider_id = child_provider_id
            updated_fields.append("provider_id")

        child_external_status = getattr(child_order, "external_status", None)
        if child_external_status and source_order.external_status != child_external_status:
            source_order.external_status = child_external_status
            updated_fields.append("external_status")

        child_completed_at = getattr(child_order, "completed_at", None)
        if child_completed_at and not source_order.completed_at:
            source_order.completed_at = child_completed_at
            updated_fields.append("completed_at")

        child_provider_message = getattr(child_order, "provider_message", None)
        if child_provider_message and source_order.provider_message != child_provider_message:
            source_order.provider_message = child_provider_message
            updated_fields.append("provider_message")

        child_last_message = getattr(child_order, "last_message", None)
        if child_last_message and source_order.last_message != child_last_message:
            source_order.last_message = child_last_message
            updated_fields.append("last_message")

        if updated_fields:
            try:
                source_order.save(update_fields=updated_fields)
            except Exception:
                source_order.save()

            logger.info(
                "Forwarded order completion propagated",
                extra={
                    "source_order_id": source_id,
                    "child_order_id": str(child_order.id),
                    "updated_fields": updated_fields,
                },
            )


def _quantize(value: Decimal, quantum: Decimal) -> Decimal:
    return value.quantize(quantum, rounding=ROUND_HALF_UP)


def _update_order_wallet_metadata(*, order_id, user: DjangoUser | None, updates: dict[str, object], unset: tuple[str, ...] = ()) -> None:
    """Safely patch the wallet transaction metadata linked to the order."""
    try:
        from apps.users.wallet_models import WalletTransaction
    except Exception as exc:  # pragma: no cover - defensive import guard
        logger.warning("WalletTransaction model import failed", extra={"order_id": str(order_id), "error": str(exc)})
        return

    qs = WalletTransaction.objects.select_for_update().filter(order_id=order_id, transaction_type='approved')
    if user is not None:
        qs = qs.filter(user=user)

    tx = qs.order_by("created_at").first()
    if tx is None:
        return

    metadata = dict(tx.metadata or {})
    for key in unset:
        metadata.pop(key, None)
    metadata.update(updates)
    tx.metadata = metadata
    tx.save(update_fields=["metadata"])


def _resolve_django_user_for_update(legacy_user: LegacyUser, tenant_id: Optional[str]) -> Optional[DjangoUser]:
    qs = DjangoUser.objects.select_for_update()

    # Direct UUID match (legacy id stored as string on new table in some environments)
    direct_match = qs.filter(id=getattr(legacy_user, "id", None)).first()
    if direct_match:
        return direct_match

    # Fallback by email/username under the same tenant when available
    filters = Q()
    email = getattr(legacy_user, "email", None)
    username = getattr(legacy_user, "username", None)
    if email:
        filters |= Q(email__iexact=email)
    if username:
        filters |= Q(username__iexact=username)

    if not filters:
        return None

    if tenant_id:
        qs = qs.filter(tenant_id=tenant_id)

    return qs.filter(filters).first()


def apply_order_status_change(
    *,
    order_id: str,
    next_status: str,
    expected_tenant_id: Optional[str] = None,
    note: Optional[str] = None,
) -> OrderStatusChange:
    normalized_status = (next_status or "").strip().lower()
    if normalized_status not in {"approved", "rejected"}:
        raise OrderStatusError("INVALID_STATUS")

    with transaction.atomic():
        try:
            # لا نستخدم select_related مع select_for_update لتجنب خطأ "FOR UPDATE cannot be applied to the nullable side of an outer join"
            order = ProductOrder.objects.select_for_update().get(id=order_id)
        except ProductOrder.DoesNotExist as exc:
            raise OrderNotFoundError("ORDER_NOT_FOUND") from exc

        if expected_tenant_id and str(order.tenant_id or "") != str(expected_tenant_id):
            raise TenantMismatchError(
                f"لا تملك صلاحية على هذا الطلب (orderTid={order.tenant_id}, reqTid={expected_tenant_id})"
            )

        if not getattr(order, "user_id", None):
            raise LegacyUserMissingError("ORDER_USER_MISSING")

        try:
            legacy_user = LegacyUser.objects.select_for_update().get(
                id=order.user_id,
                tenant_id=order.tenant_id,
            )
        except LegacyUser.DoesNotExist as exc:
            raise LegacyUserMissingError("LEGACY_USER_MISSING") from exc

        django_user = _resolve_django_user_for_update(legacy_user, order.tenant_id)
        if django_user is None:
            logger.warning(
                "Order status update missing Django user",
                extra={
                    "legacy_user_id": str(getattr(legacy_user, "id", "")),
                    "legacy_email": getattr(legacy_user, "email", None),
                    "legacy_username": getattr(legacy_user, "username", None),
                    "tenant_id": str(order.tenant_id) if order.tenant_id else None,
                },
            )

        prev_status = (str(order.status or "").strip() or "pending").lower()
        if prev_status == normalized_status:
            # Nothing to do aside from optional note update
            delta = Decimal("0")
        else:
            amount_user = order.sell_price_amount if order.sell_price_amount not in (None, "") else order.price
            amount_user_dec = _quantize(_as_decimal(amount_user), LEGACY_QUANT)
            legacy_balance = _quantize(_as_decimal(getattr(legacy_user, "balance", 0)), LEGACY_QUANT)
            django_balance = _quantize(_as_decimal(getattr(django_user, "balance", 0) if django_user else 0), DJANGO_QUANT)
            delta = Decimal("0")

            if normalized_status == "rejected" and prev_status != "rejected":
                new_legacy_balance = _quantize(legacy_balance + amount_user_dec, LEGACY_QUANT)
                legacy_user.balance = new_legacy_balance
                legacy_user.save(update_fields=["balance"])

                if django_user is not None:
                    new_django_balance = _quantize(django_balance + _quantize(amount_user_dec, DJANGO_QUANT), DJANGO_QUANT)
                    django_user.balance = new_django_balance
                    django_user.save(update_fields=["balance"])
                    
                    # [OK] تسجيل عملية الرفض في المحفظة بشكل احترافي
                    from apps.users.wallet_helpers import record_wallet_transaction
                    from apps.users.models import User
                    try:
                        # 🔒 Lock على المستخدم بعد تحديث الرصيد للحصول على القيمة الجديدة
                        locked_user = User.objects.select_for_update().get(id=django_user.id)
                        current_balance = _quantize(_as_decimal(locked_user.balance), DJANGO_QUANT)
                        
                        # جلب اسم الباقة
                        package_name = getattr(order.package, 'name', 'باقة غير معروفة') if hasattr(order, 'package') and order.package else 'باقة غير معروفة'
                        user_identifier = order.user_identifier or ''
                        order_short_id = str(order.id)[:8]
                        
                        # تحديد نوع العملية بناءً على الحالة السابقة
                        if prev_status == "approved":
                            transaction_type = 'rejected'
                            title = f"تغيير الحالة إلى رفض ({order_short_id})"
                        else:
                            transaction_type = 'rejected'
                            title = f"رفض الطلب ({order_short_id})"
                        
                        # بناء الوصف
                        description = f"{title}\n{package_name}"
                        if user_identifier:
                            description += f" - ID: {user_identifier}"
                        
                        # الرصيد بعد = الرصيد الحالي (بعد الإرجاع)
                        # الرصيد قبل = الرصيد الحالي - المبلغ المرتجع
                        balance_after = current_balance
                        balance_before = current_balance - _quantize(amount_user_dec, DJANGO_QUANT)
                        
                        record_wallet_transaction(
                            user=locked_user,
                            transaction_type=transaction_type,
                            amount=amount_user_dec,
                            description=description,
                            order_id=str(order.id),
                            balance_before=balance_before,
                            metadata={
                                'order_status': 'rejected',
                                'previous_status': prev_status,
                                'package_name': package_name,
                                'user_identifier': user_identifier,
                                'status_change': False,
                            }
                        )
                    except Exception as e:
                        logger.warning(f"Failed to record wallet transaction: {e}")

                timestamp_iso = timezone.now().isoformat()
                try:
                    _update_order_wallet_metadata(
                        order_id=order.id,
                        user=django_user,
                        updates={
                            'order_status': 'rejected',
                            'created_at_order': False,
                            'rejected_at': timestamp_iso,
                            'updated_at': timestamp_iso,
                            'previous_status': prev_status,
                        },
                        unset=('approved_at',),
                    )
                except Exception as exc:  # pragma: no cover - defensive logging
                    logger.warning(
                        "Failed to update wallet metadata on rejection",
                        extra={"order_id": str(order.id), "error": str(exc)},
                    )

                delta = amount_user_dec

            elif normalized_status == "approved" and prev_status == "rejected":
                overdraft_legacy = _quantize(_as_decimal(getattr(legacy_user, "overdraft_limit", 0)), LEGACY_QUANT)
                proposed_legacy_balance = legacy_balance - amount_user_dec
                if proposed_legacy_balance < -overdraft_legacy:
                    raise OverdraftExceededError("LEGACY_OVERDRAFT_EXCEEDED")

                legacy_user.balance = _quantize(proposed_legacy_balance, LEGACY_QUANT)
                legacy_user.save(update_fields=["balance"])

                if django_user is not None:
                    overdraft_django = _quantize(_as_decimal(getattr(django_user, "overdraft", 0)), DJANGO_QUANT)
                    proposed_django_balance = django_balance - _quantize(amount_user_dec, DJANGO_QUANT)
                    if proposed_django_balance < -overdraft_django:
                        raise OverdraftExceededError("DJANGO_OVERDRAFT_EXCEEDED")
                    django_user.balance = _quantize(proposed_django_balance, DJANGO_QUANT)
                    django_user.save(update_fields=["balance"])
                    
                    # [OK] تسجيل عملية تغيير الحالة في المحفظة بشكل احترافي
                    from apps.users.wallet_helpers import record_wallet_transaction
                    from apps.users.models import User
                    try:
                        # 🔒 Lock على المستخدم بعد تحديث الرصيد
                        locked_user = User.objects.select_for_update().get(id=django_user.id)
                        current_balance = _quantize(_as_decimal(locked_user.balance), DJANGO_QUANT)
                        
                        # جلب اسم الباقة
                        package_name = getattr(order.package, 'name', 'باقة غير معروفة') if hasattr(order, 'package') and order.package else 'باقة غير معروفة'
                        user_identifier = order.user_identifier or ''
                        order_short_id = str(order.id)[:8]
                        
                        # بناء الوصف
                        description = f"تغيير الحالة إلى قبول ({order_short_id})\n{package_name}"
                        if user_identifier:
                            description += f" - ID: {user_identifier}"
                        
                        # الرصيد بعد = الرصيد الحالي (بعد الخصم)
                        # الرصيد قبل = الرصيد الحالي + المبلغ المخصوم
                        balance_after = current_balance
                        balance_before = current_balance + _quantize(amount_user_dec, DJANGO_QUANT)
                        
                        record_wallet_transaction(
                            user=locked_user,
                            transaction_type='status_change',
                            amount=amount_user_dec,
                            description=description,
                            order_id=str(order.id),
                            balance_before=balance_before,
                            metadata={
                                'order_status': 'approved',
                                'previous_status': prev_status,
                                'package_name': package_name,
                                'user_identifier': user_identifier,
                                'status_change': True,
                            }
                        )
                    except Exception as e:
                        logger.warning(f"Failed to record wallet transaction: {e}")

                timestamp_iso = timezone.now().isoformat()
                try:
                    _update_order_wallet_metadata(
                        order_id=order.id,
                        user=django_user,
                        updates={
                            'order_status': 'approved',
                            'created_at_order': False,
                            'approved_at': timestamp_iso,
                            'updated_at': timestamp_iso,
                            'previous_status': prev_status,
                        },
                        unset=('rejected_at',),
                    )
                except Exception as exc:  # pragma: no cover - defensive logging
                    logger.warning(
                        "Failed to update wallet metadata on status change",
                        extra={"order_id": str(order.id), "error": str(exc)},
                    )

                delta = -amount_user_dec
            
            elif normalized_status == "approved" and prev_status == "pending":
                # القبول المباشر - لا نغير الرصيد (تم خصمه عند الإنشاء)
                # نحدث حالة المعاملة في سجل المحفظة من pending إلى approved
                timestamp_iso = timezone.now().isoformat()
                try:
                    _update_order_wallet_metadata(
                        order_id=order.id,
                        user=django_user,
                        updates={
                            'order_status': 'approved',
                            'created_at_order': False,
                            'approved_at': timestamp_iso,
                            'updated_at': timestamp_iso,
                            'previous_status': prev_status,
                        },
                        unset=('rejected_at',),
                    )
                except Exception as exc:  # pragma: no cover - defensive logging
                    logger.warning(
                        "Failed to update wallet metadata on approval",
                        extra={"order_id": str(order.id), "error": str(exc)},
                    )

                delta = Decimal("0")
                    # Apply status and prepare DB update payload (raw update for managed=False models reliability)
        order.status = normalized_status
        update_payload: dict[str, object] = {"status": normalized_status}

        # 🔹 Set externalStatus and completedAt based on final status (matching NestJS behavior)
        terminal_external_status = 'done' if normalized_status == 'approved' else 'failed'
        completed_at = datetime.datetime.utcnow()
        
        # Calculate durationMs if sentAt is available
        duration_ms = None
        if hasattr(order, 'sent_at') and order.sent_at:
            try:
                sent_at_dt = order.sent_at if isinstance(order.sent_at, datetime.datetime) else datetime.datetime.fromisoformat(str(order.sent_at))
                duration_ms = int((completed_at - sent_at_dt).total_seconds() * 1000)
            except Exception:
                duration_ms = getattr(order, 'duration_ms', None)
        
        order.external_status = terminal_external_status
        order.completed_at = completed_at
        if duration_ms is not None:
            order.duration_ms = duration_ms
        order.last_sync_at = completed_at
        
        update_payload.update({
            "external_status": terminal_external_status,
            "completed_at": completed_at,
            "last_sync_at": completed_at,
        })
        if duration_ms is not None:
            update_payload["duration_ms"] = duration_ms

        if note:
            trimmed_note = (note or "")[:500]
            order.manual_note = trimmed_note
            order.provider_message = trimmed_note[:250]
            order.last_message = f"Manual {normalized_status}: {trimmed_note[:200]}"
            now_iso = datetime.datetime.utcnow().isoformat()
            payload = {
                "by": "admin",
                "text": f"Manual {normalized_status}: {trimmed_note}",
                "at": now_iso,
            }
            existing_notes = list(order.notes or [])
            existing_notes.append(payload)
            order.notes = existing_notes
            if order.notes_count is not None:
                try:
                    order.notes_count = int(order.notes_count) + 1
                except Exception:
                    order.notes_count = (order.notes_count or 0) + 1
            update_payload.update(
                {
                    "manual_note": trimmed_note,
                    "provider_message": order.provider_message,
                    "last_message": order.last_message,
                    "notes": order.notes,
                    "notes_count": order.notes_count,
                }
            )
        else:
            # Set default lastMessage if no note provided
            order.last_message = f"Manual {normalized_status}"
            update_payload["last_message"] = order.last_message

        sql_sets = ['status = %s']
        sql_params: list[object] = [normalized_status]
        
        # Add externalStatus, completedAt, lastSyncAt, durationMs
        if "external_status" in update_payload:
            sql_sets.append('"externalStatus" = %s')
            sql_params.append(update_payload["external_status"])
        if "completed_at" in update_payload:
            sql_sets.append('"completedAt" = %s')
            sql_params.append(update_payload["completed_at"])
        if "last_sync_at" in update_payload:
            sql_sets.append('"lastSyncAt" = %s')
            sql_params.append(update_payload["last_sync_at"])
        if "duration_ms" in update_payload:
            sql_sets.append('"durationMs" = %s')
            sql_params.append(update_payload["duration_ms"])
            
        if "manual_note" in update_payload:
            sql_sets.append('"manualNote" = %s')
            sql_params.append(update_payload["manual_note"])
        if "provider_message" in update_payload:
            sql_sets.append('"providerMessage" = %s')
            sql_params.append(update_payload["provider_message"])
        if "last_message" in update_payload:
            sql_sets.append('"lastMessage" = %s')
            sql_params.append(update_payload["last_message"])
        if "notes" in update_payload:
            sql_sets.append('notes = %s')
            sql_params.append(json.dumps(update_payload["notes"]))
        if "notes_count" in update_payload:
            sql_sets.append('"notesCount" = %s')
            sql_params.append(update_payload["notes_count"])

        sql_params.append(str(order.id))

        sql_statement = f"UPDATE product_orders SET {', '.join(sql_sets)} WHERE id = %s"
        
        # Log the SQL for debugging
        logger.info(
            "Executing order status update SQL",
            extra={
                "order_id": str(order.id),
                "sql": sql_statement,
                "params": sql_params,
            },
        )

        with connection.cursor() as cursor:
            cursor.execute(sql_statement, sql_params)
            rows_affected = cursor.rowcount
            
        logger.info(
            "Order status update SQL executed",
            extra={
                "order_id": str(order.id),
                "rows_affected": rows_affected,
            },
        )

        # [OK] تحديث الطلب المرتبط (parent أو child) عبر externalOrderId
        if note and order.external_order_id:
            try:
                trimmed_note = (note or "")[:500]
                related_update_sql = """
                    UPDATE product_orders 
                    SET "manualNote" = %s, 
                        "providerMessage" = %s, 
                        "lastMessage" = %s
                    WHERE id = %s::uuid
                """
                with connection.cursor() as cursor:
                    cursor.execute(
                        related_update_sql,
                        [
                            trimmed_note,
                            trimmed_note[:250],
                            f"sync: {trimmed_note[:200]}",
                            str(order.external_order_id),
                        ]
                    )
                    related_rows = cursor.rowcount
                    if related_rows > 0:
                        logger.info(
                            f"[OK] Updated related order via externalOrderId",
                            extra={
                                "order_id": str(order.id),
                                "external_order_id": str(order.external_order_id),
                                "rows_affected": related_rows,
                            }
                        )
            except Exception as e:
                logger.warning(
                    f"Failed to update related order via externalOrderId: {e}",
                    extra={"order_id": str(order.id), "external_order_id": str(order.external_order_id)}
                )

        try:
            order.refresh_from_db()
        except ProductOrder.DoesNotExist:
            logger.error("Order disappeared after status update", extra={"order_id": str(order.id)})
        except Exception:
            logger.exception("Failed to refresh order after status update", extra={"order_id": str(order.id)})

        try:
            current_status = (
                ProductOrder.objects.filter(id=order.id)
                .values_list("status", flat=True)
                .first()
            )
            logger.debug(
                "Order status persisted",
                extra={
                    "order_id": str(order.id),
                    "prev_status": prev_status,
                    "next_status": normalized_status,
                    "db_status": current_status,
                    "delta": str(delta),
                },
            )
        except Exception:
            logger.exception("Failed to verify persisted order status", extra={"order_id": str(order.id)})

        # Freeze FX rates when approving order
        if normalized_status == 'approved':
            try:
                freeze_fx_on_approval(order_id=str(order.id))
            except Exception:
                logger.exception("Failed to freeze FX on approval", extra={"order_id": str(order.id)})
        
        # Unfreeze FX rates when moving from approved to another status
        if prev_status == 'approved' and normalized_status != 'approved':
            try:
                unfreeze_fx_on_unapproval(order_id=str(order.id))
            except Exception:
                logger.exception("Failed to unfreeze FX on unapproval", extra={"order_id": str(order.id)})

        if _chain_propagation_enabled():
            try:
                _propagate_chain_status(order, origin="manual_status_change", manual_note=note)
            except Exception:
                logger.exception(
                    "Failed to propagate chain status",
                    extra={
                        "order_id": str(order.id),
                        "origin": "manual_status_change",
                        "next_status": normalized_status,
                    },
                )

        django_updated = django_user is not None and prev_status != normalized_status and delta != 0
        return OrderStatusChange(
            order=order,
            previous_status=prev_status,
            delta_amount_user_currency=delta,
            django_user_updated=django_updated,
        )


def freeze_fx_on_approval(order_id: str) -> None:
    """
    Freeze FX rates and calculate profits when an order is approved.
    
    This function:
    1. Checks if the order is already locked (fxLocked = True)
    2. Fetches current TRY exchange rate from currencies table
    3. Calculates sell/cost/profit in TRY based on current FX
    4. Saves all values to database with fxLocked = True
    5. Sets approvedAt, approvedLocalDate, approvedLocalMonth
    
    This ensures that once an order is approved, its financial values are frozen
    and won't change when currency rates are updated later.
    """
    from apps.currencies.models import Currency
    from apps.products.models import ProductPackage
    
    try:
        order = ProductOrder.objects.select_related('user', 'package').get(id=order_id)
    except ProductOrder.DoesNotExist:
        logger.warning("Cannot freeze FX: order not found", extra={"order_id": order_id})
        return
    
    # Check if already locked
    if getattr(order, 'fx_locked', False) is True:
        logger.debug("Order FX already locked, skipping", extra={"order_id": order_id})
        return
    
    # Get tenant_id
    tenant_id = getattr(order.user, 'tenant_id', None) if order.user else None
    
    # Fetch TRY rate from currencies table (same tenant)
    try_query = Currency.objects.filter(code='TRY', is_active=True)
    if tenant_id:
        try_query = try_query.filter(tenant_id=tenant_id)
    
    try_row = try_query.first()
    fx_usd_try = Decimal(str(try_row.rate)) if try_row and try_row.rate else Decimal('1')
    
    # Calculate sellTryAtApproval
    price_usd = Decimal(str(order.price or 0))
    sell_try_at_approval = _quantize(price_usd * fx_usd_try, Decimal('0.01'))
    
    # Calculate costTryAtApproval - المنطق الصحيح حسب نوع التنفيذ
    qty = Decimal(str(order.quantity or 1))
    base_usd = Decimal('0')
    
    # [OK] الحالة 1: مزود خارجي (external provider)
    if order.provider_id and order.external_order_id:
        print(f"[MONEY] [Cost Logic] Order {str(order.id)[:8]}... - External Provider")
        print(f"   Provider ID: {order.provider_id}")
        print(f"   Package ID: {order.package_id}")
        
        # خذ التكلفة من PackageCost المرتبط بهذا المزود
        from apps.providers.models import PackageCost
        try:
            package_cost = PackageCost.objects.get(
                tenant_id=tenant_id,
                package_id=order.package_id,
                provider_id=order.provider_id
            )
            cost_currency = package_cost.cost_currency or 'USD'
            cost_amount_original = Decimal(str(package_cost.cost_amount or 0))
            
            print(f"   [OK] Found PackageCost:")
            print(f"      Amount: {cost_amount_original}")
            print(f"      Currency: {cost_currency}")
            
            # [REFRESH] تحويل العملة إلى USD إذا لزم الأمر
            if cost_currency.upper() == 'USD':
                base_usd = cost_amount_original
                print(f"      [OK] Already in USD: ${base_usd}")
            else:
                # التكلفة بعملة أخرى (مثل TRY) - يجب التحويل
                print(f"      [REFRESH] Converting {cost_currency} to USD...")
                from apps.currencies.models import Currency
                
                try:
                    currency_row = Currency.objects.filter(
                        code=cost_currency.upper(),
                        tenant_id=tenant_id,
                        is_active=True
                    ).first()
                    
                    if currency_row and currency_row.rate and Decimal(str(currency_row.rate)) > 0:
                        exchange_rate = Decimal(str(currency_row.rate))
                        # إذا كان rate = 41.50 (يعني 1 USD = 41.50 TRY)
                        # فإن USD = TRY / rate
                        base_usd = cost_amount_original / exchange_rate
                        print(f"         Exchange rate: 1 USD = {exchange_rate} {cost_currency}")
                        print(f"         Calculation: {cost_amount_original} / {exchange_rate} = ${base_usd:.4f} USD")
                    else:
                        print(f"         [WARNING] Exchange rate not found, using cost as-is")
                        base_usd = cost_amount_original
                except Exception as e:
                    print(f"         [ERROR] Error converting currency: {e}")
                    base_usd = cost_amount_original
                    
        except PackageCost.DoesNotExist:
            print(f"   [WARNING] PackageCost not found - falling back to package base_price")
            # Fallback: استخدم base_price من الباقة
            if order.package:
                try:
                    pkg = ProductPackage.objects.get(id=order.package_id)
                    base_usd = Decimal(str(pkg.base_price or pkg.capital or 0))
                    print(f"   [PACKAGE] Using package base_price: ${base_usd}")
                except ProductPackage.DoesNotExist:
                    print(f"   [ERROR] Package not found")
                    pass
    
    # [OK] الحالة 2: تنفيذ داخلي (internal/manual)
    elif order.status == 'approved' and not order.provider_id:
        print(f"[MONEY] [Cost Logic] Order {str(order.id)[:8]}... - Internal/Manual Execution")
        base_usd = Decimal('0')  # التكلفة = 0 للتنفيذ الداخلي
        print(f"   [OK] Cost = $0 (internal execution)")
    
    # [OK] الحالة 3: pending أو من مجموعة الأسعار (price group)
    else:
        print(f"[MONEY] [Cost Logic] Order {str(order.id)[:8]}... - Pending/Price Group")
        # خذ التكلفة من base_price (تقديرية من price_group)
        if order.package:
            try:
                pkg = ProductPackage.objects.get(id=order.package_id)
                base_usd = Decimal(str(pkg.base_price or pkg.capital or 0))
                print(f"   [PACKAGE] Using package base_price: ${base_usd} (estimated)")
            except ProductPackage.DoesNotExist:
                print(f"   [ERROR] Package not found")
                pass
    
    cost_try_at_approval = _quantize(base_usd * qty * fx_usd_try, Decimal('0.01'))
    print(f"   [COST] Final cost calculation: ${base_usd} × {qty} × {fx_usd_try} = {cost_try_at_approval} TRY")
    
    # Calculate profits
    profit_try_at_approval = _quantize(sell_try_at_approval - cost_try_at_approval, Decimal('0.01'))
    profit_usd_at_approval = _quantize(profit_try_at_approval / fx_usd_try, Decimal('0.01')) if fx_usd_try > 0 else Decimal('0')
    
    # Get approved timestamp
    approved_at = getattr(order, 'approved_at', None) or datetime.datetime.utcnow()
    if not isinstance(approved_at, datetime.datetime):
        approved_at = datetime.datetime.utcnow()
    
    # Calculate local date/month (Istanbul timezone = UTC+3)
    # Simple approach: add 3 hours to UTC
    approved_local = approved_at + datetime.timedelta(hours=3)
    approved_local_date = approved_local.date()
    approved_local_month = approved_local.strftime('%Y-%m')
    
    # Update order with frozen values using raw SQL for reliability
    with connection.cursor() as cursor:
        cursor.execute("""
            UPDATE product_orders
            SET 
                "fxUsdTryAtApproval" = %s,
                "sellTryAtApproval" = %s,
                "costTryAtApproval" = %s,
                "profitTryAtApproval" = %s,
                "profitUsdAtApproval" = %s,
                "fxCapturedAt" = %s,
                "approvedAt" = %s,
                "approvedLocalDate" = %s,
                "approvedLocalMonth" = %s,
                "fxLocked" = TRUE
            WHERE id = %s
        """, [
            float(fx_usd_try),
            float(sell_try_at_approval),
            float(cost_try_at_approval),
            float(profit_try_at_approval),
            float(profit_usd_at_approval),
            datetime.datetime.utcnow(),
            approved_at,
            approved_local_date,
            approved_local_month,
            str(order.id),
        ])
    
    logger.info(
        "FX frozen on approval",
        extra={
            "order_id": str(order.id),
            "fx_usd_try": str(fx_usd_try),
            "sell_try": str(sell_try_at_approval),
            "cost_try": str(cost_try_at_approval),
            "profit_try": str(profit_try_at_approval),
            "profit_usd": str(profit_usd_at_approval),
        }
    )


def unfreeze_fx_on_unapproval(order_id: str) -> None:
    """
    Unfreeze FX rates when an order is moved from approved to another status.
    Clears all frozen financial values.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE product_orders
                SET 
                    "fxLocked" = FALSE,
                    "fxUsdTryAtApproval" = NULL,
                    "sellTryAtApproval" = NULL,
                    "costTryAtApproval" = NULL,
                    "profitTryAtApproval" = NULL,
                    "profitUsdAtApproval" = NULL,
                    "fxCapturedAt" = NULL,
                    "approvedAt" = NULL,
                    "approvedLocalDate" = NULL,
                    "approvedLocalMonth" = NULL
                WHERE id = %s
            """, [str(order_id)])
        
        logger.info("FX unfrozen on unapproval", extra={"order_id": str(order_id)})
    except Exception:
        logger.exception("Failed to unfreeze FX", extra={"order_id": str(order_id)})


def try_auto_dispatch_async(order_id: str, tenant_id: Optional[str] = None) -> dict:
    """
    محاولة إرسال الطلب تلقائياً للمزود الخارجي (ASYNC - سريع جداً!).
    
    هذه الدالة تجدول إرسال الطلب في الخلفية عبر Celery، مما يجعل الاستجابة
    فورية للمستخدم (0.5 ثانية بدلاً من 5 ثواني).
    
    المنطق:
    1. التحقق السريع من الطلب والإعدادات
    2. إذا auto-dispatch مفعّل، نجدول Task في الخلفية
    3. نرجع فوراً للمستخدم
    4. Celery يرسل الطلب في الخلفية
    
    Args:
        order_id: معرّف الطلب
        tenant_id: معرّف المستأجر (اختياري للتحقق)
        
    Returns:
        dict: {'dispatched': bool, 'async': bool, 'task_id': str}
    """
    from apps.providers.models import PackageRouting
    from .tasks_dispatch import send_order_to_provider_async
    
    print(f"\n{'='*80}")
    print(f"[ROCKET] AUTO-DISPATCH (ASYNC): Order ID = {order_id}")
    print(f"{'='*80}\n")
    
    try:
        # 1. فحص سريع: هل الطلب قابل للإرسال؟
        order = ProductOrder.objects.select_related('package').get(id=order_id)
        
        # GUARDRAIL 1: Check if order status is already terminal
        if order.status in ('approved', 'rejected', 'failed'):
            logger.critical(
                "FATAL: Attempting to dispatch order with terminal status",
                extra={
                    "order_id": order_id,
                    "status": order.status,
                    "provider_id": order.provider_id,
                    "external_order_id": order.external_order_id
                }
            )
            print(f"   [FATAL] Order status is '{order.status}' (terminal) - SKIPPING")
            return {'dispatched': False, 'async': False, 'reason': 'terminal_status'}
        
        # GUARDRAIL 2: Check if external_order_id already exists (block re-dispatch)
        # EXCEPTION: Allow forwarded orders from Client API (provider_id may be set for tracking)
        # These orders have external_order_id pointing to source order but haven't been dispatched to final provider yet
        has_been_dispatched_to_provider = (
            order.external_order_id and 
            not order.external_order_id.startswith('stub-') and
            order.provider_id and
            order.provider_id not in ('MANUAL', 'CHAIN_FORWARD', '') and
            order.status in ('processing', 'completed', 'approved')  # Terminal or processing states
        )
        
        if has_been_dispatched_to_provider:
            logger.warning(
                "Blocking re-dispatch: order already dispatched to provider",
                extra={
                    "order_id": order_id,
                    "external_order_id": order.external_order_id,
                    "provider_id": order.provider_id,
                    "status": order.status
                }
            )
            print(f"   [WARNING] Order already dispatched - SKIPPING")
            print(f"   - External Order ID: {order.external_order_id}")
            print(f"   - Provider ID: {order.provider_id}")
            print(f"   - Status: {order.status}")
            return {'dispatched': False, 'async': False, 'reason': 'already_dispatched_to_provider'}
        
        # إذا كان external_order_id يبدأ بـ "stub-" فهذا يعني أنه تم توجيهه مؤقتاً ويحتاج إعادة معالجة
        is_stub_forward = order.external_order_id and order.external_order_id.startswith('stub-')
        
        # الشرط الأساسي: إذا كان provider_id موجود والطلب تم إرساله فعلياً
        if not is_stub_forward and order.provider_id and order.status != 'pending':
            print(f"   [SKIP] Order already dispatched or not pending, skipping")
            return {'dispatched': False, 'async': False, 'reason': 'already_dispatched'}
        
        if is_stub_forward:
            print(f"   [REFRESH] Order was forwarded (stub), attempting auto-dispatch to final provider...")
            
            # CHAIN COST CALCULATION: Compute cost for intermediate tenant before forwarding
            if not order.cost_price_usd:
                print(f"   [MONEY] Computing intermediate cost for chain forwarding...")
                try:
                    cost_snapshot = _compute_manual_cost_snapshot(order)
                    order.cost_price_usd = cost_snapshot.unit_cost_usd
                    order.cost_try_at_order = None  # Will be calculated later if needed
                    order.cost_source = cost_snapshot.source
                    order.save(update_fields=['cost_price_usd', 'cost_try_at_order', 'cost_source'])
                    print(f"   [OK] Intermediate cost computed: {cost_snapshot.unit_cost_usd} USD")
                except Exception as exc:
                    print(f"   [WARNING] Failed to compute intermediate cost: {exc}")
                    logger.warning(
                        "Failed to compute intermediate cost for chain forwarding",
                        extra={"order_id": order_id, "error": str(exc)}
                    )
        
        # 2. فحص سريع: هل التوجيه مفعّل؟
        try:
            routing = PackageRouting.objects.get(
                package_id=order.package_id,
                tenant_id=order.tenant_id
            )
        except PackageRouting.DoesNotExist:
            print(f"   [SKIP] No routing config, skipping")
            
        # PATCH 5.x: Ensure manual mode when no routing exists
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE product_orders
                    SET mode = 'MANUAL',
                        "providerId" = NULL,
                        status = 'PENDING'
                    WHERE id = %s AND (mode IS NULL OR mode != 'MANUAL' OR "providerId" IS NOT NULL)
                    """,
                    [str(order.id)]
                )
            
            # Calculate manual cost using PriceGroup USD value directly
            if _usd_enforcement_enabled():
                try:
                    cost_snapshot = _compute_manual_cost_snapshot(order)
                    _persist_cost_snapshot(
                        order_id=order.id,
                        snapshot=cost_snapshot,
                        quantity=order.quantity or 1,
                        tenant_id=order.tenant_id,
                        mode='MANUAL',
                    )
                    _write_dispatch_log(
                        order.id,
                        action='MANUAL_COST_CALCULATION',
                        result='success',
                        message=f'Manual cost calculated: {cost_snapshot.unit_cost_usd} USD per unit',
                        payload=cost_snapshot.as_log_payload(),
                    )
                except CostComputationError as exc:
                    logger.warning(
                        "Failed to calculate manual cost for order without routing",
                        extra={"order_id": str(order.id), "error": str(exc)}
                    )
        except Exception:
            pass
            
            return {'dispatched': False, 'async': False, 'reason': 'no_routing'}
        
        routing_mode = (routing.mode or '').strip().lower()
        routing_provider_type = (routing.provider_type or '').strip().lower()

        if routing_mode != 'auto' or routing_provider_type not in ('external', 'codes', 'internal_codes'):
            print(f"   [SKIP] Routing not configured for auto-dispatch (mode={routing.mode}, type={routing.provider_type})")
            
            # MANUAL COST CALCULATION: Calculate cost for manual orders even if not auto-dispatch
            if routing_mode == 'manual' and _usd_enforcement_enabled():
                print(f"   [MONEY] Calculating manual cost for manual routing...")
                try:
                    cost_snapshot = _compute_manual_cost_snapshot(order)
                    _persist_cost_snapshot(
                        order_id=order.id,
                        snapshot=cost_snapshot,
                        quantity=order.quantity or 1,
                        tenant_id=order.tenant_id,
                        mode='MANUAL',
                    )
                    _write_dispatch_log(
                        order.id,
                        action="MANUAL_COST_CALCULATION",
                        result="success",
                        payload=cost_snapshot.as_log_payload(),
                    )
                    print(f"   [OK] Manual cost calculated: {cost_snapshot.unit_cost_usd} USD")
                except CostComputationError as exc:
                    print(f"   [WARNING] Failed to calculate manual cost: {exc}")
                    logger.warning(
                        "Failed to calculate manual cost for manual routing",
                        extra={"order_id": str(order.id), "error": str(exc)}
                    )
            
            return {'dispatched': False, 'async': False, 'reason': 'not_auto'}
        
        # 3. جدولة الإرسال في الخلفية (فوري!)
        print(f"   [ASYNC] Scheduling async dispatch...")
        
        # استخدام apply() بدلاً من apply_async() لأن CELERY_TASK_ALWAYS_EAGER لا يعمل مع apply_async
        # apply() تنفّذ المهمة فوراً عندما CELERY_TASK_ALWAYS_EAGER=True
        task = send_order_to_provider_async.apply(
            args=[str(order_id), str(tenant_id or order.tenant_id)]
        )
        
        print(f"   [OK] Task executed!")
        print(f"   - Task ID: {task.id}")
        # Safely print task result without Unicode issues
        try:
            result_str = str(task.result)
            result_str = result_str.encode('ascii', 'replace').decode('ascii')
            print(f"   - Result: {result_str}")
        except Exception:
            print(f"   - Result: [Result available but could not display]")
        print(f"{'='*80}\n")
        
        return {
            'dispatched': True,
            'async': True,
            'task_id': str(task.id),
            'message': 'Order dispatch scheduled in background'
        }
        
    except Exception as e:
        print(f"   [ERROR] Error scheduling async dispatch: {e}")
        print(f"{'='*80}\n")
        return {'dispatched': False, 'async': False, 'error': str(e)}


def try_auto_dispatch(
    order_id: str,
    tenant_id: Optional[str] = None,
    *,
    _override_provider_id: Optional[str] = None,
    _fallback_origin: Optional[str] = None,
    _fallback_reason: Optional[str] = None,
    _disable_auto_fallback: bool = False,
) -> None:
    """
    محاولة إرسال الطلب تلقائياً للمزود الخارجي حسب إعدادات التوجيه (package_routing).
    
    [WARNING] هذه الدالة SYNC (بطيئة - 5 ثواني).
    للأداء الأفضل، استخدم try_auto_dispatch_async() بدلاً منها.
    
    المنطق:
    1. التحقق من أن الطلب في حالة pending ولم يتم إرساله بعد
    2. قراءة إعدادات PackageRouting للباقة
    3. إذا كان mode=auto و providerType=external، نرسل الطلب للمزود
    4. استخدام PackageMapping لمعرفة معرّف الباقة عند المزود الخارجي
    5. إرسال الطلب وتحديث حالة الطلب حسب النتيجة
    
    Args:
        order_id: معرّف الطلب
        tenant_id: معرّف المستأجر (اختياري للتحقق)
    """
    from apps.providers.models import PackageRouting, PackageMapping, PackageCost, Integration
    from apps.providers.adapters import resolve_adapter_credentials
    
    print(f"\n{'='*80}")
    print(f"[AUTO-DISPATCH START (SYNC)]: Order ID = {order_id}")
    print(f"{'='*80}\n")
    
    try:
        # 1. جلب الطلب مع العلاقات
        print(f"[Step 1] Fetching order...")
        order = ProductOrder.objects.select_related('user', 'package', 'product').get(id=order_id)
        print(f"   [OK] Order found: {order_id}")
        print(f"   - Status: {order.status}")
        print(f"   - Package ID: {order.package_id}")
        print(f"   - Product ID: {order.product_id}")
        print(f"   - User Identifier: {order.user_identifier}")
        print(f"   - Extra Field: {order.extra_field}")
        print(f"   - Quantity: {order.quantity}")
        
        # GUARDRAIL 1: Check if order status is already terminal
        if order.status in ('approved', 'rejected', 'failed'):
            logger.critical(
                "FATAL: Attempting to dispatch order with terminal status",
                extra={
                    "order_id": order_id,
                    "status": order.status,
                    "provider_id": order.provider_id,
                    "external_order_id": order.external_order_id
                }
            )
            print(f"   [FATAL] Order status is '{order.status}' (terminal) - SKIPPING")
            return
        
        # GUARDRAIL 2: Check if external_order_id already exists (block re-dispatch)
        # EXCEPTION: Allow forwarded orders from Client API (provider_id may be set for tracking)
        # These orders have external_order_id pointing to source order but haven't been dispatched to final provider yet
        has_been_dispatched_to_provider = (
            order.external_order_id and 
            not order.external_order_id.startswith('stub-') and
            order.provider_id and
            order.provider_id not in ('MANUAL', 'CHAIN_FORWARD', '') and
            order.status in ('processing', 'completed', 'approved')  # Terminal or processing states
        )
        
        if has_been_dispatched_to_provider:
            logger.warning(
                "Blocking re-dispatch: order already dispatched to provider",
                extra={
                    "order_id": order_id,
                    "external_order_id": order.external_order_id,
                    "provider_id": order.provider_id,
                    "status": order.status
                }
            )
            print(f"   [WARNING] Order already dispatched - SKIPPING")
            print(f"   - External Order ID: {order.external_order_id}")
            print(f"   - Provider ID: {order.provider_id}")
            print(f"   - Status: {order.status}")
            return
            
    except ProductOrder.DoesNotExist:
        print(f"   [ERROR] Order not found: {order_id}")
        logger.warning("Auto-dispatch: Order not found", extra={"order_id": order_id})
        return
    
    # التحقق من المستأجر
    print(f"\n[CLIPBOARD] Step 2: Verifying tenant...")
    if tenant_id and str(order.tenant_id) != str(tenant_id):
        print(f"   [ERROR] Tenant mismatch!")
        print(f"   - Expected: {tenant_id}")
        print(f"   - Actual: {order.tenant_id}")
        logger.warning("Auto-dispatch: Tenant mismatch", extra={
            "order_id": order_id,
            "expected_tenant": tenant_id,
            "actual_tenant": str(order.tenant_id)
        })
        return
    
    effective_tenant_id = str(order.tenant_id)
    print(f"   [OK] Tenant verified: {effective_tenant_id}")

    enforcement_enabled = _usd_enforcement_enabled()
    auto_fallback_active = _auto_fallback_enabled() and not _disable_auto_fallback
    
    # 2. التحقق من أن الطلب لم يُرسل بعد
    print(f"\n[SEARCH] Step 3: Checking if order was already dispatched...")
    
    # إذا كان external_order_id يبدأ بـ "stub-" فهذا يعني أنه تم توجيهه مؤقتاً ويحتاج إعادة معالجة
    is_stub_forward = order.external_order_id and order.external_order_id.startswith('stub-')
    
    # الشرط الأساسي: إذا كان provider_id موجود والطلب تم إرساله فعلياً
    if not is_stub_forward and order.provider_id and order.status != 'pending':
        print(f"   [WARNING] Order already dispatched or not pending - SKIPPING")
        print(f"   - Status: {order.status}")
        print(f"   - Provider ID: {order.provider_id}")
        print(f"   - External Order ID: {order.external_order_id}")
        logger.debug("Auto-dispatch: Order already dispatched or not pending", extra={
            "order_id": order_id,
            "status": order.status,
            "provider_id": order.provider_id,
            "external_order_id": order.external_order_id
        })
        return
    
    if is_stub_forward:
        print(f"   [REFRESH] Order was forwarded with stub ID - attempting final auto-dispatch...")
        
        # CHAIN COST CALCULATION: Compute cost for intermediate tenant before forwarding
        if not order.cost_price_usd:
            print(f"   [MONEY] Computing intermediate cost for chain forwarding...")
            try:
                cost_snapshot = _compute_manual_cost_snapshot(order)
                order.cost_price_usd = cost_snapshot.unit_cost_usd
                order.cost_try_at_order = None  # Will be calculated later if needed
                order.cost_source = cost_snapshot.source
                order.save(update_fields=['cost_price_usd', 'cost_try_at_order', 'cost_source'])
                print(f"   [OK] Intermediate cost computed: {cost_snapshot.unit_cost_usd} USD")
            except Exception as exc:
                print(f"   [WARNING] Failed to compute intermediate cost: {exc}")
                logger.warning(
                    "Failed to compute intermediate cost for chain forwarding",
                    extra={"order_id": order_id, "error": str(exc)}
                )
    else:
        print(f"   [OK] Order is pending and not yet dispatched")
    
    # 3. جلب إعدادات التوجيه للباقة
    print(f"\n[GEAR] Step 4: Loading PackageRouting configuration...")
    print(f"   - Package ID: {order.package_id}")
    print(f"   - Tenant ID: {effective_tenant_id}")
    try:
        routing = PackageRouting.objects.get(
            package_id=order.package_id,
            tenant_id=effective_tenant_id
        )
        print(f"   [OK] PackageRouting found!")
        print(f"   - Mode: {routing.mode}")
        print(f"   - Provider Type: {routing.provider_type}")
        print(f"   - Primary Provider ID: {routing.primary_provider_id}")
    except PackageRouting.DoesNotExist:
        print(f"   [ERROR] No PackageRouting configured - SKIPPING")
        logger.debug("Auto-dispatch: No routing configured", extra={
            "order_id": order_id,
            "package_id": str(order.package_id),
            "tenant_id": effective_tenant_id
        })
        
        # PATCH 5.x: Ensure manual mode when no routing exists
        # Set mode=MANUAL and clear provider_id if it was incorrectly set
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE product_orders
                    SET mode = 'MANUAL',
                        "providerId" = NULL,
                        status = 'PENDING'
                    WHERE id = %s AND (mode IS NULL OR mode != 'MANUAL' OR "providerId" IS NOT NULL)
                    """,
                    [str(order.id)]
                )
                rows_affected = cursor.rowcount
                if rows_affected > 0:
                    print(f"   [OK] Set mode=MANUAL and cleared provider_id (no routing)")
                    
                    # Calculate manual cost using PriceGroup USD value directly
                    if _usd_enforcement_enabled():
                        try:
                            cost_snapshot = _compute_manual_cost_snapshot(order)
                            _persist_cost_snapshot(
                                order_id=order.id,
                                snapshot=cost_snapshot,
                                quantity=order.quantity or 1,
                                tenant_id=order.tenant_id,
                                mode='MANUAL',
                            )
                            _write_dispatch_log(
                                order.id,
                                action='MANUAL_COST_CALCULATION',
                                result='success',
                                message=f'Manual cost calculated: {cost_snapshot.unit_cost_usd} USD per unit',
                                payload=cost_snapshot.as_log_payload(),
                            )
                            print(f"   [MONEY] Manual cost calculated: {cost_snapshot.unit_cost_usd} USD per unit")
                        except CostComputationError as exc:
                            logger.warning(
                                "Failed to calculate manual cost for order without routing",
                                extra={"order_id": order_id, "error": str(exc)}
                            )
        except Exception as exc:
            logger.warning(
                "Failed to set manual mode for order without routing",
                extra={"order_id": order_id, "error": str(exc)}
            )
        
        return
    
    # 4. التحقق من إعدادات التوجيه التلقائي
    print(f"\n[CHECK] Step 5: Validating routing configuration...")
    routing_mode = (routing.mode or '').strip().lower()
    routing_provider_type = (routing.provider_type or '').strip().lower()
    dispatch_override_active = bool(_override_provider_id)
    is_codes_provider = routing_provider_type in ('codes', 'internal_codes') and not dispatch_override_active

    if routing_mode != 'auto':
        print(f"   [WARNING] Routing mode is NOT 'auto' (it's '{routing.mode}') - SKIPPING")
        
        # MANUAL COST CALCULATION: Calculate cost for manual orders even if not auto-dispatch
        if routing_mode == 'manual' and _usd_enforcement_enabled():
            print(f"   [MONEY] Calculating manual cost for manual routing...")
            try:
                cost_snapshot = _compute_manual_cost_snapshot(order)
                _persist_cost_snapshot(
                    order_id=order.id,
                    snapshot=cost_snapshot,
                    quantity=order.quantity or 1,
                    tenant_id=order.tenant_id,
                    mode='MANUAL',
                )
                _write_dispatch_log(
                    order.id,
                    action="MANUAL_COST_CALCULATION",
                    result="success",
                    payload=cost_snapshot.as_log_payload(),
                )
                print(f"   [OK] Manual cost calculated: {cost_snapshot.unit_cost_usd} USD")
            except CostComputationError as exc:
                print(f"   [WARNING] Failed to calculate manual cost: {exc}")
                logger.warning(
                    "Failed to calculate manual cost for manual routing",
                    extra={"order_id": str(order.id), "error": str(exc)}
                )
        
        logger.debug("Auto-dispatch: Routing mode is not auto", extra={
            "order_id": order_id,
            "mode": routing.mode
        })
        return
    print(f"   [OK] Mode is 'auto'")
    
    if routing_provider_type not in ('external', 'codes', 'internal_codes'):
        print(f"   [WARNING] Provider type is '{routing.provider_type}' (not 'external' or 'codes') - SKIPPING")
        logger.debug("Auto-dispatch: Provider type not supported", extra={
            "order_id": order_id,
            "provider_type": routing.provider_type
        })
        return
    print(f"   [OK] Provider type is '{routing.provider_type}'")

    # === CHAIN FORWARDING: التوجيه متعدد المراحل ===
    print(f"\n[CHAIN] Step 5.5: Checking for chain forwarding...")
    
    # تحديد المستأجر التالي في السلسلة
    chain_info = _determine_next_tenant_in_chain(
        current_tenant_id=str(order.tenant_id),
        package_id=str(order.package_id)
    )
    
    if chain_info:
        target_tenant_id, target_package_id, target_user_id = chain_info
        print(f"   [REFRESH] Chain forwarding detected!")
        print(f"   - Target Tenant: {target_tenant_id}")
        print(f"   - Target Package: {target_package_id}")
        print(f"   - Target User: {target_user_id}")
        
        # إنشاء طلب جديد في المستأجر التالي
        new_order = _create_chain_forward_order(
            source_order=order,
            target_tenant_id=target_tenant_id,
            target_package_id=target_package_id,
            target_user_id=target_user_id
        )
        
        if new_order:
            print(f"   [OK] Chain forward order created successfully!")
            print(f"   - New Order ID: {new_order.id}")
            print(f"   - Root Order: {new_order.root_order_id}")
            print(f"   - Chain Path: {new_order.chain_path}")
            
            # تحديث الطلب الأصلي ليعكس التوجيه
            order.external_order_id = f"stub-{new_order.id}"
            order.provider_id = "CHAIN_FORWARD"
            order.external_status = "forwarded"
            order.provider_message = f"Forwarded to tenant {target_tenant_id}"
            order.last_message = f"Chain forwarded to {target_tenant_id}"
            order.mode = "CHAIN_FORWARD"
            
            # تحديث chain_path
            import json
            if order.chain_path:
                try:
                    current_path = json.loads(order.chain_path) if isinstance(order.chain_path, str) else order.chain_path
                except (json.JSONDecodeError, TypeError):
                    current_path = [str(order.id)]
            else:
                current_path = [str(order.id)]
            
            if str(new_order.id) not in current_path:
                current_path.append(str(new_order.id))
            order.chain_path = json.dumps(current_path)
            
            order.save(update_fields=[
                'external_order_id', 'provider_id', 'external_status', 
                'provider_message', 'last_message', 'mode', 'chain_path'
            ])
            
            print(f"   [OK] Source order updated with chain forwarding info")
            
            # محاولة التوجيه التلقائي للطلب الجديد
            print(f"\n[ROCKET] Attempting auto-dispatch for chain forward order...")
            try:
                from .tasks_dispatch import send_order_to_provider_async
                task = send_order_to_provider_async.apply(
                    args=[str(new_order.id), str(target_tenant_id)]
                )
                print(f"   [OK] Chain forward order dispatch scheduled!")
                print(f"   - Task ID: {task.id}")
            except Exception as exc:
                print(f"   [WARNING] Failed to schedule chain forward dispatch: {exc}")
                logger.warning(
                    "Failed to schedule chain forward dispatch",
                    extra={
                        "new_order_id": str(new_order.id),
                        "target_tenant_id": target_tenant_id,
                        "error": str(exc)
                    }
                )
                
                # إضافة منطق إعادة المحاولة للطلبات المُوجَّهة في السلسلة
                print(f"   [RETRY] Attempting direct auto-dispatch for chain forward order...")
                try:
                    # محاولة مباشرة للتوجيه التلقائي
                    try_auto_dispatch(str(new_order.id), str(target_tenant_id))
                    print(f"   [SUCCESS] Direct auto-dispatch succeeded for chain forward order!")
                except Exception as direct_exc:
                    print(f"   [ERROR] Direct auto-dispatch also failed: {direct_exc}")
                    logger.error(
                        "Direct auto-dispatch failed for chain forward order",
                        extra={
                            "new_order_id": str(new_order.id),
                            "target_tenant_id": target_tenant_id,
                            "error": str(direct_exc)
                        }
                    )
            
            return  # انتهاء التوجيه متعدد المراحل
        else:
            print(f"   [ERROR] Failed to create chain forward order")
            return
    else:
        print(f"   [SKIP] No chain forwarding configured for this tenant")

    fallback_provider_id_raw = getattr(routing, 'fallback_provider_id', None)
    fallback_provider_id = str(fallback_provider_id_raw).strip() if fallback_provider_id_raw else None
    fallback_already_marked = False
    if fallback_provider_id:
        fallback_already_marked = _has_fallback_marker(order, fallback_provider_id)
    
    # For 'codes' provider, we need code_group_id; for 'external', we need primary_provider_id
    if is_codes_provider:
        if routing.code_group_id:
            print(f"   [OK] Code group configured: {routing.code_group_id}")
    elif routing_provider_type == 'external' or dispatch_override_active:
        configured_provider = _override_provider_id or routing.primary_provider_id
        if not configured_provider:
            print(f"   [ERROR] No provider configured for 'external' routing - SKIPPING")
            logger.debug("Auto-dispatch: No provider configured", extra={
                "order_id": order_id
            })
            return
        if _override_provider_id:
            print(f"   [OK] Using override provider: {_override_provider_id}")
        else:
            print(f"   [OK] Primary provider configured: {routing.primary_provider_id}")
    
    # === CODES PROVIDER: استخدام الأكواد الداخلية ===
    if is_codes_provider:
        print(f"\n[FLOPPY] Step 6: Processing CODES provider...")
        print(f"   - Code Group ID: {routing.code_group_id}")

        codes_origin = f"codes:{routing.code_group_id}" if routing.code_group_id else "codes"

        if fallback_provider_id:
            print(f"   [REFRESH] Fallback provider configured: {fallback_provider_id}")
            if fallback_already_marked:
                print(f"   [WARNING] Fallback already attempted previously (marker present) - will not auto-reroute again")

        def _trigger_codes_fallback(reason: str, message: Optional[str] = None):
            nonlocal fallback_already_marked
            if not fallback_provider_id:
                print(f"   [WARNING] Codes fallback requested but no fallback provider configured")
                return None
            if not auto_fallback_active:
                print(f"   [WARNING] Auto fallback disabled; cannot fallback from codes (reason={reason})")
                return None
            if _disable_auto_fallback:
                print(f"   [WARNING] Auto fallback explicitly disabled for this attempt")
                return None
            if fallback_already_marked:
                print(f"   [WARNING] Fallback already attempted previously (marker present) - skipping codes fallback")
                return None

            print(f"   [REPEAT] Triggering fallback provider {fallback_provider_id} due to {reason}")
            _mark_fallback_attempt(
                order=order,
                from_provider=codes_origin,
                to_provider=str(fallback_provider_id),
                reason=reason,
            )
            fallback_already_marked = True
            _log_fallback_event(
                order_id,
                from_provider=codes_origin,
                to_provider=str(fallback_provider_id),
                stage='start',
                reason=reason,
                message=message,
            )
            return try_auto_dispatch(
                order_id,
                tenant_id,
                _override_provider_id=str(fallback_provider_id),
                _fallback_origin=codes_origin,
                _fallback_reason=reason,
                _disable_auto_fallback=True,
            )

        # إذا كان الطلب معاد توجيهه (stub)، نعيد تعيين provider_id و external_order_id
        if is_stub_forward:
            print(f"   [REFRESH] Clearing stub forward data...")
            order.provider_id = None
            order.external_order_id = None
            order.external_status = None
            order.sent_at = None
            order.provider_message = None

        from apps.codes.models import CodeGroup, CodeItem

        if not routing.code_group_id:
            print(f"   [ERROR] No code group configured for 'codes' provider - CANNOT DISPATCH!")
            logger.debug("Auto-dispatch: No code group configured", extra={
                "order_id": order_id
            })
            result = _trigger_codes_fallback("codes_missing_group")
            if result is not None:
                return result
            return

        try:
            code_group = CodeGroup.objects.get(id=routing.code_group_id, tenant_id=effective_tenant_id)
            print(f"   [OK] Code group found: {code_group.name}")

            # حساب الأكواد المتاحة
            total_codes = code_group.items.count()
            used_codes = code_group.items.filter(status='used').count()
            available_codes = code_group.items.filter(status='available').count()

            print(f"   - Total codes: {total_codes}")
            print(f"   - Used codes: {used_codes}")
            print(f"   - Available codes: {available_codes}")
        except CodeGroup.DoesNotExist:
            print(f"   [ERROR] Code group not found - CANNOT DISPATCH!")
            logger.warning("Auto-dispatch: Code group not found", extra={
                "order_id": order_id,
                "code_group_id": str(routing.code_group_id)
            })
            result = _trigger_codes_fallback("codes_group_not_found")
            if result is not None:
                return result
            return
        except Exception as exc:
            print(f"   [ERROR] Failed to load code group - {exc}")
            logger.warning("Auto-dispatch: Code group load failure", extra={
                "order_id": order_id,
                "code_group_id": str(routing.code_group_id),
                "error": str(exc),
            })
            result = _trigger_codes_fallback("codes_group_error", message=str(exc))
            if result is not None:
                return result
            return

        # التحقق من توفر الأكواد
        if available_codes == 0:
            print(f"   [ERROR] No available codes in group - CANNOT DISPATCH!")
            logger.warning("Auto-dispatch: No codes available", extra={
                "order_id": order_id,
                "code_group_id": str(routing.code_group_id)
            })
            result = _trigger_codes_fallback("codes_depleted")
            if result is not None:
                return result
            return

        # سحب كود واحد
        available_code = CodeItem.objects.filter(
            group_id=routing.code_group_id,
            tenant_id=effective_tenant_id,
            status='available'
        ).first()

        if not available_code:
            print(f"   [ERROR] No unused code found - CANNOT DISPATCH!")
            logger.warning("Auto-dispatch: No unused code found", extra={
                "order_id": order_id,
                "code_group_id": str(routing.code_group_id)
            })
            result = _trigger_codes_fallback("codes_no_available_item")
            if result is not None:
                return result
            return

        # تجهيز الكود للعرض (PIN أو Serial)
        code_text = available_code.pin or available_code.serial or "No code available"
        print(f"   [OK] Code retrieved: {code_text[:10]}...")

        # تحديث الطلب - لا نضع حالة نهائية في try_auto_dispatch
        # الحالة النهائية ستُحدد بواسطة Celery polling أو إجراء إداري صريح
        completion_ts = timezone.now()
        order.manual_note = code_text
        order.status = 'sent'  # لا نضع 'approved' - فقط 'sent' أو 'pending'
        order.external_status = 'sent'  # لا نضع 'completed' - فقط 'sent'
        order.provider_message = code_text
        order.last_message = code_text
        order.save()

        _propagate_forward_completion(order, code_text)

        # تحديث الكود كمستخدم
        available_code.status = 'used'
        available_code.order_id = order.id
        available_code.used_at = completion_ts
        available_code.save()

        print(f"   [OK] Order dispatched successfully!")
        print(f"   - Code placed in manual_note")
        print(f"   - Status updated to 'approved'")
        print(f"   - Code marked as used")

        logger.info("Auto-dispatch: Codes provider completed", extra={
            "order_id": order_id,
            "code_group_id": str(routing.code_group_id)
        })
        return
    
    # === EXTERNAL PROVIDER: إرسال إلى مزود خارجي ===
    
    provider_id = _override_provider_id or routing.primary_provider_id
    provider_label = 'Fallback' if _fallback_origin else 'Primary'
    print(f"   [OK] {provider_label} Provider ID: {provider_id}")
    if _fallback_origin:
        _log_fallback_event(
            order_id,
            from_provider=_fallback_origin,
            to_provider=str(provider_id),
            stage='retry',
            reason=_fallback_reason,
        )
    if fallback_provider_id:
        print(f"   [REFRESH] Fallback Provider ID: {fallback_provider_id}")
        if fallback_already_marked:
            print(f"   [WARNING] Fallback already attempted previously (marker present) - will not auto-reroute again")
    
    # 5. جلب معلومات الـ mapping
    print(f"\n[CHAIN] Step 6: Loading PackageMapping...")
    print(f"   - Our Package ID: {order.package_id}")
    print(f"   - Provider ID: {provider_id}")
    try:
        mapping = PackageMapping.objects.get(
            our_package_id=order.package_id,
            provider_api_id=provider_id,
            tenant_id=effective_tenant_id
        )
        print(f"   [OK] PackageMapping found!")
        print(f"   - Provider Package ID: {mapping.provider_package_id}")
    except PackageMapping.DoesNotExist:
        print(f"   [ERROR] No PackageMapping found - CANNOT DISPATCH!")
        logger.warning("Auto-dispatch: No mapping found", extra={
            "order_id": order_id,
            "package_id": str(order.package_id),
            "provider_id": provider_id
        })
        return
    
    provider_package_id = mapping.provider_package_id
    
    # 6. جلب معلومات Integration للمزود
    print(f"\n[PLUG] Step 7: Loading Integration details...")
    try:
        integration = Integration.objects.get(id=provider_id, tenant_id=effective_tenant_id)
        print(f"   [OK] Integration found!")
        print(f"   - Provider: {integration.provider}")
        print(f"   - Base URL: {integration.base_url}")
        print(f"   - Has kod: {bool(getattr(integration, 'kod', None))}")
        print(f"   - Has sifre: {bool(getattr(integration, 'sifre', None))}")
    except Integration.DoesNotExist:
        print(f"   [ERROR] Integration not found - CANNOT DISPATCH!")
        logger.warning("Auto-dispatch: Integration not found", extra={
            "order_id": order_id,
            "provider_id": provider_id
        })
        return
    
    # 7. إعداد الـ adapter والـ credentials
    print(f"\n[KEY] Step 8: Resolving adapter credentials...")
    binding, creds = resolve_adapter_credentials(
        integration.provider,
        base_url=integration.base_url,
        api_token=getattr(integration, 'api_token', None),
        kod=getattr(integration, 'kod', None),
        sifre=getattr(integration, 'sifre', None),
    )
    
    if not binding or not creds:
        print(f"   [ERROR] Could not resolve adapter credentials - CANNOT DISPATCH!")
        logger.warning("Auto-dispatch: Could not resolve adapter credentials", extra={
            "order_id": order_id,
            "provider": integration.provider
        })
        return
    
    print(f"   [OK] Adapter credentials resolved!")
    print(f"   - Adapter: {binding.adapter.__class__.__name__}")
    print(f"   - Credentials type: {type(creds).__name__}")
    
    # 8. إعداد payload للإرسال
    print(f"\n[SEND] Step 9: Building payload...")
    
    # جلب معلومات المنتج من المزود للحصول على oyun و kupur
    print(f"   [SATELLITE] Fetching provider products to get metadata...")
    try:
        provider_products = binding.adapter.list_products(creds)
        print(f"   [OK] Got {len(provider_products)} products from provider")
        
        # طباعة أول 3 منتجات لفهم الـ structure
        print(f"\n   [CLIPBOARD] Sample products from provider (first 3):")
        for i, p in enumerate(provider_products[:3]):
            print(f"      Product {i+1}:")
            print(f"         - externalId: {p.get('externalId')}")
            # طباعة name بطريقة آمنة
            try:
                name = str(p.get('name', 'N/A'))
                print(f"         - name: {name}")
            except UnicodeEncodeError:
                print(f"         - name: [Unicode name]")
            # طباعة meta بطريقة آمنة
            meta = p.get('meta', {})
            if meta:
                print(f"         - meta keys: {list(meta.keys())}")
                print(f"         - oyun_bilgi_id: {meta.get('oyun_bilgi_id')}")
                print(f"         - kupur: {meta.get('kupur')}")
            else:
                print(f"         - meta: None")
            if i >= 2:
                break
        
        print(f"\n   [SEARCH] Looking for packageExternalId = '{provider_package_id}'...")
        
        # البحث عن المنتج المطابق
        matched_product = None
        for p in provider_products:
            # نبحث في externalId (وليس packageExternalId)
            if str(p.get('externalId')) == str(provider_package_id):
                matched_product = p
                break
        
        oyun = None
        kupur = None
        
        if matched_product:
            print(f"   [OK] Found matching product in provider catalog!")
            print(f"      Matched product details:")
            print(f"         - externalId: {matched_product.get('externalId')}")
            # طباعة name بطريقة آمنة
            try:
                name = str(matched_product.get('name', 'N/A'))
                print(f"         - name: {name}")
            except UnicodeEncodeError:
                print(f"         - name: [Unicode name]")
            # طباعة meta بطريقة آمنة
            meta = matched_product.get('meta', {})
            if meta:
                print(f"         - meta keys: {list(meta.keys())}")
                print(f"         - oyun_bilgi_id: {meta.get('oyun_bilgi_id')}")
                print(f"         - kupur: {meta.get('kupur')}")
            else:
                print(f"         - meta: None")
            
            # استخراج oyun و kupur من metadata
            meta = matched_product.get('meta') or {}
            
            # oyun_bilgi_id من metadata
            oyun_bilgi_id = meta.get('oyun_bilgi_id')
            if oyun_bilgi_id:
                oyun = str(oyun_bilgi_id)
                print(f"      - oyun (from meta.oyun_bilgi_id): {oyun}")
            else:
                # fallback: استخدام externalId
                oyun = str(matched_product.get('externalId'))
                print(f"      - oyun (from externalId, fallback): {oyun}")
            
            # kupur من metadata أو externalId
            kupur_from_meta = meta.get('kupur')
            if kupur_from_meta:
                kupur = str(kupur_from_meta)
                print(f"      - kupur (from meta.kupur): {kupur}")
            else:
                # fallback: استخدام externalId
                kupur = str(matched_product.get('externalId'))
                print(f"      - kupur (from externalId, fallback): {kupur}")
        else:
            print(f"   [ERROR] Product NOT found in provider catalog!")
            print(f"      Will use provider_package_id as fallback for both oyun and kupur")
            # استخدام القيم الافتراضية
            oyun = str(provider_package_id)
            kupur = str(provider_package_id)
    except Exception as e:
        print(f"   [WARNING] Could not fetch provider products: {e}")
        print(f"   Will use provider_package_id as fallback")
        # استخدام القيم الافتراضية
        oyun = str(provider_package_id)
        kupur = str(provider_package_id)
    
    # نبني الـ payload مثل ما يفعل backend القديم
    payload = {
        'productId': str(provider_package_id),
        'qty': int(order.quantity or 1),
        'params': {},
        'orderId': str(order.id),  # referans للـ znet
        'referans': str(order.id),  # للتوافق
    }
    
    # إضافة المعاملات
    if order.user_identifier:
        payload['params']['oyuncu_bilgi'] = str(order.user_identifier)
    
    if order.extra_field:
        payload['params']['extra'] = str(order.extra_field)
    
    if oyun:
        payload['params']['oyun'] = oyun
    
    if kupur:
        payload['params']['kupur'] = kupur
    
    # إضافة userIdentifier و extraField على المستوى الأعلى أيضاً
    if order.user_identifier:
        payload['userIdentifier'] = str(order.user_identifier)
    
    if order.extra_field:
        payload['extraField'] = str(order.extra_field)
    
    print(f"   [OK] Payload built:")
    print(f"   - Product ID: {payload['productId']}")
    print(f"   - Quantity: {payload['qty']}")
    print(f"   - Order ID (referans): {payload['orderId']}")
    print(f"   - User Identifier: {payload.get('userIdentifier', 'N/A')}")
    print(f"   - Extra Field: {payload.get('extraField', 'N/A')}")
    print(f"   - Params: {payload['params']}")
    print(f"   - Full payload: {payload}")
    
    # 9. جلب معلومات التكلفة (اختياري)
    print(f"\n[MONEY] Step 10: Loading cost information...")
    cost_currency = 'USD'
    cost_amount = Decimal('0')
    try:
        cost_row = PackageCost.objects.get(
            package_id=order.package_id,
            provider_id=provider_id,
            tenant_id=effective_tenant_id
        )
        cost_currency = _normalize_currency_code(cost_row.cost_currency, 'USD')
        cost_amount = Decimal(str(cost_row.cost_amount or 0))
        print(f"   [OK] PackageCost found: {cost_amount} {cost_currency}")
    except PackageCost.DoesNotExist:
        # fallback إلى base_price من الباقة
        if order.package:
            try:
                from apps.products.models import ProductPackage
                pkg = ProductPackage.objects.get(id=order.package_id)
                cost_amount = Decimal(str(pkg.base_price or pkg.capital or 0))
                print(f"   [WARNING] No PackageCost, using package base_price: {cost_amount} {cost_currency}")
            except Exception:
                print(f"   [WARNING] Could not load cost info, using 0")
                pass
    
    # 10. إرسال الطلب للمزود
    try:
        print(f"\n[ROCKET] Step 11: SENDING ORDER TO PROVIDER...")
        print(f"   - Provider: {integration.provider}")
        print(f"   - Provider Package ID: {provider_package_id}")
        print(f"   - Payload: {payload}")

        logger.info("Auto-dispatch: Sending order to provider", extra={
            "order_id": order_id,
            "provider_id": provider_id,
            "provider": integration.provider,
            "provider_package_id": provider_package_id,
            "payload": payload
        })

        should_log_dispatch = enforcement_enabled or auto_fallback_active or bool(_fallback_origin)
        dispatch_log_payload = {"provider": integration.provider, "payload": payload}
        allow_fallback = bool(
            auto_fallback_active
            and fallback_provider_id
            and fallback_provider_id != str(provider_id)
            and not fallback_already_marked
        )

        print(f"\n   [SATELLITE] Calling adapter.place_order()...")
        if should_log_dispatch:
            _write_dispatch_log(
                order.id,
                action="DISPATCH",
                result="pending",
                payload=dispatch_log_payload,
            )

        try:
            result = binding.adapter.place_order(creds, str(provider_package_id), payload)
        except Exception as exc:
            print(f"   [ERROR] Provider call raised an exception: {exc}")
            logger.exception(
                "Auto-dispatch: Provider raised exception",
                extra={
                    "order_id": order_id,
                    "provider_id": provider_id,
                    "provider": integration.provider,
                },
            )
            fallback_reason = _classify_fallback_reason(status=None, note=None, error=str(exc))
            if should_log_dispatch:
                _write_dispatch_log(
                    order.id,
                    action="DISPATCH",
                    result="error",
                    message=str(exc),
                    payload=dispatch_log_payload,
                )
            if allow_fallback and fallback_reason in ("no_balance", "unavailable"):
                print(f"   [REPEAT] Triggering fallback provider due to {fallback_reason} (exception)")
                _mark_fallback_attempt(
                    order=order,
                    from_provider=str(provider_id),
                    to_provider=str(fallback_provider_id),
                    reason=fallback_reason,
                )
                _log_fallback_event(
                    order_id,
                    from_provider=str(provider_id),
                    to_provider=str(fallback_provider_id),
                    stage="start",
                    reason=fallback_reason,
                    message=str(exc),
                )
                return try_auto_dispatch(
                    order_id,
                    tenant_id,
                    _override_provider_id=str(fallback_provider_id),
                    _fallback_origin=str(provider_id),
                    _fallback_reason=fallback_reason,
                    _disable_auto_fallback=True,
                )
            raise

        print(f"   [OK] Provider responded!")
        # Safely print result without Unicode issues
        try:
            result_str = str(result)
            # Replace problematic characters
            result_str = result_str.encode('ascii', 'replace').decode('ascii')
            print(f"   - Response: {result_str}")
        except Exception:
            print(f"   - Response: [Response received but could not display]")

        if should_log_dispatch:
            _write_dispatch_log(
                order.id,
                action="DISPATCH",
                result="success",
                payload={"response": _prepare_log_payload(result)},
            )

        # 11. معالجة النتيجة وتحديث الطلب
        print(f"\n[STEP 12] Processing provider response...")
        external_order_id = result.get('externalOrderId') or str(order.id)
        status_raw = result.get('status') or result.get('providerStatus') or 'sent'
        note = result.get('note') or result.get('message') or 'sent'
        provider_referans = result.get('providerReferans') or result.get('referans') or str(order.id)

        print(f"   - External Order ID: {external_order_id}")
        print(f"   - Status (raw): {status_raw}")
        # Safely print note without Unicode issues
        try:
            note_str = str(note)
            note_str = note_str.encode('ascii', 'replace').decode('ascii')
            print(f"   - Note: {note_str}")
        except Exception:
            print(f"   - Note: [Note available but could not display]")
        print(f"   - Provider Referans: {provider_referans}")

        # تحديد external_status
        # PATCH 5.x: Never set terminal status on dispatch - only Celery polling can set terminal states
        # After dispatch, we always use 'sent' or 'processing' - even if provider returns 'completed'
        # The check_order_status task will handle terminal state transitions
        external_status = 'processing'
        if status_raw in ['sent', 'accepted', 'queued', 'queue', 'pending', 'processing']:
            external_status = 'sent'
        elif status_raw in ['completed', 'done', 'success', 'failed', 'rejected', 'error']:
            # Provider returned a terminal status immediately - but we don't trust it yet
            # Keep it as 'processing' and let Celery polling confirm the terminal state
            external_status = 'processing'
            print(f"   [WARNING] Provider returned terminal status '{status_raw}' but keeping as 'processing'")
            print(f"   [INFO] Celery polling will confirm terminal state transition")
        else:
            external_status = 'sent'

        print(f"   - External Status (mapped): {external_status}")

        fallback_reason = _classify_fallback_reason(status=status_raw, note=note, error=None)
        if allow_fallback and external_status == 'failed' and fallback_reason in ("no_balance", "unavailable"):
            print(f"   [REPEAT] Triggering fallback provider due to {fallback_reason} (response)")
            if should_log_dispatch:
                _write_dispatch_log(
                    order.id,
                    action="DISPATCH",
                    result="error",
                    message=f"fallback={fallback_reason}",
                    payload={"response": _prepare_log_payload(result)},
                )
            _mark_fallback_attempt(
                order=order,
                from_provider=str(provider_id),
                to_provider=str(fallback_provider_id),
                reason=fallback_reason,
            )
            _log_fallback_event(
                order_id,
                from_provider=str(provider_id),
                to_provider=str(fallback_provider_id),
                stage="start",
                reason=fallback_reason,
                payload=result,
            )
            return try_auto_dispatch(
                order_id,
                tenant_id,
                _override_provider_id=str(fallback_provider_id),
                _fallback_origin=str(provider_id),
                _fallback_reason=fallback_reason,
                _disable_auto_fallback=True,
            )

        if _fallback_origin and external_status == 'failed':
            _log_fallback_event(
                order_id,
                from_provider=_fallback_origin,
                to_provider=str(provider_id),
                stage='error',
                reason=_fallback_reason or fallback_reason,
                payload=result,
                message=f"Fallback provider returned status={status_raw}",
            )
        
        enforcement_enabled = _usd_enforcement_enabled()
        use_legacy_cost_flow = not enforcement_enabled
        qty = max(int(order.quantity or 1), 1)
        cost_source = None
        cost_price_usd: Decimal | None = None
        cost_currency = 'USD'
        cost_amount = Decimal('0')
        cost_usd_at_order = Decimal('0')
        sell_usd_at_order = Decimal(str(order.price or 0))
        profit_usd_at_order = sell_usd_at_order
        fx_usd_try = Decimal('1')
        cost_try_at_order = Decimal('0')
        sell_try_at_order = Decimal('0')
        profit_try_at_order = Decimal('0')

        if enforcement_enabled:
            try:
                cost_snapshot = _compute_cost_snapshot_enforced(
                    order,
                    tenant_id=effective_tenant_id,
                    provider_id=provider_id,
                    provider_response=result,
                )
                cost_source = cost_snapshot.source
                cost_price_usd = cost_snapshot.unit_cost_usd
                cost_usd_at_order = (cost_price_usd * Decimal(qty)).quantize(Decimal('0.0001'))
                cost_currency = 'USD'
                cost_amount = cost_usd_at_order
                profit_usd_at_order = sell_usd_at_order - cost_usd_at_order

                try:
                    fx_usd_try = _fetch_currency_rate(effective_tenant_id, 'TRY')
                except CostComputationError as fx_exc:
                    fx_usd_try = Decimal('1')
                    logger.warning(
                        "TRY FX rate unavailable during cost snapshot",
                        extra={
                            "order_id": order_id,
                            "tenant_id": str(effective_tenant_id),
                            "error": str(fx_exc),
                        },
                    )

                cost_try_at_order = (cost_usd_at_order * fx_usd_try).quantize(Decimal('0.01'))
                sell_try_at_order = (sell_usd_at_order * fx_usd_try).quantize(Decimal('0.01'))
                profit_try_at_order = (profit_usd_at_order * fx_usd_try).quantize(Decimal('0.01'))

                _ensure_sell_snapshot(order, sell_usd=sell_usd_at_order, fx_rate=fx_usd_try)
                _persist_cost_snapshot(
                    order_id=order.id,
                    snapshot=cost_snapshot,
                    quantity=qty,
                    tenant_id=effective_tenant_id,
                    mode='auto_dispatch',
                )
                _write_dispatch_log(
                    order.id,
                    action='COST_SNAPSHOT',
                    result='success',
                    payload=cost_snapshot.as_log_payload(),
                )
            except CostComputationError as exc:
                use_legacy_cost_flow = True
                logger.warning(
                    "Cost enforcement snapshot failed",
                    extra={
                        "order_id": order_id,
                        "tenant_id": str(effective_tenant_id),
                        "provider_id": provider_id,
                        "reason": str(exc),
                    },
                )
                _write_dispatch_log(
                    order.id,
                    action='COST_SNAPSHOT',
                    result='error',
                    message=str(exc),
                    payload={"provider_response": _prepare_log_payload(result)},
                )

        if use_legacy_cost_flow:
            print(f"\n[MONEY] Calculating actual cost from provider response / PackageCost...")
            actual_cost_usd = Decimal('0')
            cost_source = 'unknown'
            final_cost_currency = 'USD'
            final_cost_amount_in_original_currency = Decimal('0')

            provider_cost_raw = result.get('cost')
            provider_cost_currency = _normalize_currency_code(result.get('costCurrency'), 'USD')
            if provider_cost_raw is not None:
                try:
                    final_cost_amount_in_original_currency = Decimal(str(provider_cost_raw))
                    final_cost_currency = provider_cost_currency
                    cost_source = 'provider_response'
                    print(f"   [OK] Provider supplied cost: {final_cost_amount_in_original_currency} {final_cost_currency}")

                    if final_cost_currency == 'USD':
                        actual_cost_usd = final_cost_amount_in_original_currency
                        print(f"      [OK] Already in USD: ${actual_cost_usd}")
                    else:
                        print(f"      [REFRESH] Converting {final_cost_currency} to USD (provider response)...")
                        from apps.currencies.models import Currency

                        currency_row = Currency.objects.filter(
                            code=final_cost_currency,
                            tenant_id=effective_tenant_id,
                            is_active=True
                        ).first()

                        if currency_row and currency_row.rate:
                            rate = Decimal(str(currency_row.rate))
                            if rate > 0:
                                actual_cost_usd = final_cost_amount_in_original_currency / rate
                                print(f"         Exchange rate: 1 USD = {rate} {final_cost_currency}")
                                print(f"         Calculation: {final_cost_amount_in_original_currency} / {rate} = ${actual_cost_usd:.2f} USD")
                            else:
                                actual_cost_usd = final_cost_amount_in_original_currency
                                print(f"         [WARNING] Invalid rate value {rate}, using original amount")
                        else:
                            actual_cost_usd = final_cost_amount_in_original_currency
                            print(f"         [WARNING] Exchange rate not found, using original amount")
                except Exception as exc:
                    print(f"   [WARNING] Failed to parse provider cost: {exc}")
                    final_cost_amount_in_original_currency = Decimal('0')
                    final_cost_currency = 'USD'
                    cost_source = 'unknown'

            if cost_source != 'provider_response':
                try:
                    package_cost = PackageCost.objects.get(
                        tenant_id=effective_tenant_id,
                        package_id=order.package_id,
                        provider_id=provider_id
                    )
                    final_cost_currency = _normalize_currency_code(package_cost.cost_currency, 'USD')
                    final_cost_amount_in_original_currency = Decimal(str(package_cost.cost_amount or 0))
                    cost_source = 'PackageCost'

                    print(f"   [OK] Found PackageCost:")
                    print(f"      Amount: {final_cost_amount_in_original_currency}")
                    print(f"      Currency: {final_cost_currency}")

                    if final_cost_currency == 'USD':
                        actual_cost_usd = final_cost_amount_in_original_currency
                        print(f"      [OK] Already in USD: ${actual_cost_usd}")
                    else:
                        print(f"      [REFRESH] Converting {final_cost_currency} to USD...")
                        from apps.currencies.models import Currency

                        try:
                            currency_row = Currency.objects.filter(
                                code=final_cost_currency,
                                tenant_id=effective_tenant_id,
                                is_active=True
                            ).first()

                            if currency_row and currency_row.rate and Decimal(str(currency_row.rate)) > 0:
                                exchange_rate = Decimal(str(currency_row.rate))
                                actual_cost_usd = final_cost_amount_in_original_currency / exchange_rate
                                print(f"         Exchange rate: 1 USD = {exchange_rate} {final_cost_currency}")
                                print(f"         Calculation: {final_cost_amount_in_original_currency} / {exchange_rate} = ${actual_cost_usd:.2f} USD")
                            else:
                                print(f"         [WARNING] Exchange rate not found, using cost as-is")
                                actual_cost_usd = final_cost_amount_in_original_currency
                        except Exception as e:
                            print(f"         [ERROR] Error converting currency: {e}")
                            actual_cost_usd = final_cost_amount_in_original_currency

                except PackageCost.DoesNotExist:
                    print(f"   [WARNING] PackageCost not found for provider {provider_id}")

                    if order.package:
                        try:
                            pkg = ProductPackage.objects.get(id=order.package_id)
                            actual_cost_usd = Decimal(str(pkg.base_price or pkg.capital or 0))
                            final_cost_amount_in_original_currency = actual_cost_usd
                            final_cost_currency = 'USD'
                            cost_source = 'package.base_price'
                            print(f"   [PACKAGE] Using package.base_price: ${actual_cost_usd}")
                        except ProductPackage.DoesNotExist:
                            print(f"   [ERROR] Package not found")
                            pass

            qty = int(order.quantity or 1)
            total_cost_usd = actual_cost_usd * qty
            cost_amount = final_cost_amount_in_original_currency * qty
            cost_currency = final_cost_currency
            print(f"   [COST] Total cost: ${actual_cost_usd:.4f} × {qty} = ${total_cost_usd:.2f} USD (from {cost_source})")

            if result.get('cost') is not None and cost_source != 'provider_response':
                try:
                    provider_cost = Decimal(str(result['cost']))
                    print(f"   [INFO] Provider returned cost: ${provider_cost} (ignored, using PackageCost instead)")
                except Exception:
                    pass

            if result.get('balance') is not None:
                # Safely print balance without Unicode issues
                try:
                    balance_str = str(result.get('balance'))
                    balance_str = balance_str.encode('ascii', 'replace').decode('ascii')
                    print(f"   - Provider balance: {balance_str}")
                except Exception:
                    print(f"   - Provider balance: [Balance available but could not display]")

            sell_usd_at_order = Decimal(str(order.price or 0))
            cost_usd_at_order = total_cost_usd
            profit_usd_at_order = sell_usd_at_order - cost_usd_at_order

            print(f"\n[COST] USD Snapshots:")
            print(f"   - Sell USD: ${sell_usd_at_order}")
            print(f"   - Cost USD: ${cost_usd_at_order} (from {cost_source})")
            print(f"   - Profit USD: ${profit_usd_at_order}")

            from apps.currencies.models import Currency
            fx_usd_try = Decimal('1')
            try:
                currency_try = Currency.objects.filter(
                    tenant_id=effective_tenant_id,
                    code__iexact='TRY',
                    is_active=True
                ).first()
                if currency_try and currency_try.rate:
                    fx_usd_try = Decimal(str(currency_try.rate))
            except Exception as e:
                print(f"   [WARNING] Could not fetch TRY exchange rate: {e}")

            cost_try_at_order = cost_usd_at_order * fx_usd_try
            sell_try_at_order = sell_usd_at_order * fx_usd_try
            profit_try_at_order = profit_usd_at_order * fx_usd_try

            print(f"\n[MONEY] TRY Snapshots (FROZEN - will never change!):")
            print(f"   - Exchange Rate: 1 USD = {fx_usd_try} TRY")
            print(f"   - Sell TRY: {sell_try_at_order:.2f}")
            print(f"   - Cost TRY: {cost_try_at_order:.2f}")
            print(f"   - Profit TRY: {profit_try_at_order:.2f}")
        
        # تحديث الطلب
        print(f"\n[FLOPPY] Step 13: Updating order in database...")
        now = datetime.datetime.utcnow()
        
        # Try to save provider_referans if column exists, otherwise skip it
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE product_orders
                    SET 
                        "providerId" = %s,
                        "externalOrderId" = %s,
                        "externalStatus" = %s,
                        "sentAt" = %s,
                        "lastSyncAt" = %s,
                        "lastMessage" = %s,
                        "providerMessage" = %s,
                        "costCurrency" = %s,
                        "costAmount" = %s,
                        provider_referans = %s,
                        cost_usd_at_order = %s,
                        sell_usd_at_order = %s,
                        profit_usd_at_order = %s,
                        cost_try_at_order = %s,
                        sell_try_at_order = %s,
                        profit_try_at_order = %s,
                        fx_usd_try_at_order = %s
                    WHERE id = %s
                """, [
                    provider_id,
                    external_order_id,
                    external_status,
                    now,
                    now,
                    str(note)[:250],
                    str(note)[:250],
                    cost_currency,
                    float(cost_amount),
                    provider_referans,
                    float(cost_usd_at_order),
                    float(sell_usd_at_order),
                    float(profit_usd_at_order),
                    float(cost_try_at_order),
                    float(sell_try_at_order),
                    float(profit_try_at_order),
                    float(fx_usd_try),
                    str(order.id)
                ])
        except Exception as e:
            # If provider_referans column doesn't exist, update without it
            print(f"   [WARNING] Could not save provider_referans (column may not exist yet): {e}")
            print(f"   [INFO] Saving order without provider_referans...")
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE product_orders
                    SET 
                        "providerId" = %s,
                        "externalOrderId" = %s,
                        "externalStatus" = %s,
                        "sentAt" = %s,
                        "lastSyncAt" = %s,
                        "lastMessage" = %s,
                        "providerMessage" = %s,
                        "costCurrency" = %s,
                        "costAmount" = %s,
                        cost_usd_at_order = %s,
                        sell_usd_at_order = %s,
                        profit_usd_at_order = %s
                    WHERE id = %s
                """, [
                    provider_id,
                    external_order_id,
                    external_status,
                    now,
                    now,
                    str(note)[:250],
                    str(note)[:250],
                    cost_currency,
                    float(cost_amount),
                    float(cost_usd_at_order),
                    float(sell_usd_at_order),
                    float(profit_usd_at_order),
                    str(order.id)
                ])
        
        print(f"   [OK] Order updated in database")
        print(f"   - Provider ID: {provider_id}")
        print(f"   - External Order ID: {external_order_id}")
        print(f"   - External Status: {external_status}")
        print(f"   - Provider Referans: {provider_referans}")
        print(f"   - Sent At: {now}")
        
        # PATCH 5.x: CRITICAL GUARDRAIL - Verify no premature terminal status
        # Re-fetch from DB to ensure status field was NOT updated
        order.refresh_from_db()
        if order.status in ('approved', 'rejected', 'failed'):
            logger.critical(
                "FATAL: Premature terminal status detected immediately after dispatch!",
                extra={
                    "order_id": order_id,
                    "status": order.status,
                    "external_status": external_status,
                    "provider_id": provider_id,
                },
                stack_info=True,
            )
            print(f"\n{'='*80}")
            print(f"🚨 CRITICAL ERROR: Order status is '{order.status}' immediately after dispatch!")
            print(f"   This should NEVER happen - only Celery polling should set terminal states")
            print(f"{'='*80}\n")
        else:
            print(f"   [OK] Guardrail passed: Order status is '{order.status}' (not terminal)")
        
        # إضافة ملاحظة للطلب
        print(f"\n[CLIPBOARD] Step 14: Adding note to order...")
        try:
            notes = list(order.notes or [])
            notes.append({
                'by': 'system',
                'text': f'Auto-dispatch → ext={external_status}, msg={note[:200]}',
                'at': now.isoformat()
            })
            
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE product_orders
                    SET 
                        notes = %s,
                        "notesCount" = %s
                    WHERE id = %s
                """, [
                    json.dumps(notes),
                    len(notes),
                    str(order.id)
                ])
            print(f"   [OK] Note added to order")
        except Exception as e:
            print(f"   [WARNING] Failed to add note: {e}")
            logger.warning("Failed to add auto-dispatch note", extra={
                "order_id": order_id,
                "error": str(e)
            })

        if _fallback_origin and external_status != 'failed':
            _log_fallback_event(
                order_id,
                from_provider=_fallback_origin,
                to_provider=str(provider_id),
                stage='success',
                reason=_fallback_reason or fallback_reason,
                payload={
                    "response": _prepare_log_payload(result),
                    "external_status": external_status,
                },
            )

        print(f"\n{'='*80}")
        print(f"[OK] AUTO-DISPATCH SUCCESS!")
        print(f"   Order {order_id} sent to {integration.provider}")
        print(f"   External Order ID: {external_order_id}")
        print(f"   Status: {external_status}")
        print(f"{'='*80}\n")
        
        logger.info("Auto-dispatch: Order sent successfully", extra={
            "order_id": order_id,
            "external_order_id": external_order_id,
            "external_status": external_status,
            "provider_id": provider_id
        })
        
        # [CLIPBOARD] Step 15: Schedule status check
        print(f"\nStep 15: Scheduling status check...")
        try:
            from .tasks import check_order_status
            
            # Schedule status check to run after 10 seconds
            task = check_order_status.apply_async(
                args=[str(order.id), str(effective_tenant_id)],
                countdown=10  # Start checking after 10 seconds
            )
            print(f"   [OK] Status check scheduled!")
            print(f"   - Task ID: {task.id}")
            print(f"   - Will start in: 10 seconds")
            print(f"   - Will retry every 10 seconds until completed")
            
            logger.info("Auto-dispatch: Status check task scheduled", extra={
                "order_id": order_id,
                "task_id": str(task.id),
                "countdown": 10
            })
        except Exception as e:
            print(f"   [WARNING] Failed to schedule status check: {e}")
            logger.warning("Auto-dispatch: Failed to schedule status check", extra={
                "order_id": order_id,
                "error": str(e)
            })
        
    except Exception as e:
        print(f"\n{'='*80}")
        print(f"[ERROR] AUTO-DISPATCH FAILED!")
        print(f"   Order: {order_id}")
        print(f"   Error Type: {type(e).__name__}")
        print(f"   Error Message: {str(e)}")
        print(f"{'='*80}\n")
        
        import traceback
        print(f"[CLIPBOARD] Full traceback:")
        print(traceback.format_exc())
        
        logger.error("Auto-dispatch: Failed to send order", extra={
            "order_id": order_id,
            "provider_id": provider_id,
            "error": str(e),
            "error_type": type(e).__name__
        }, exc_info=True)
        
        # إضافة ملاحظة بالفشل
        try:
            notes = list(order.notes or [])
            notes.append({
                'by': 'system',
                'text': f'Auto-dispatch failed: {str(e)[:200]}',
                'at': datetime.datetime.utcnow().isoformat()
            })
            
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE product_orders
                    SET 
                        notes = %s,
                        "notesCount" = %s,
                        "lastMessage" = %s
                    WHERE id = %s
                """, [
                    json.dumps(notes),
                    len(notes),
                    f'Auto-dispatch failed: {str(e)[:200]}',
                    str(order.id)
                ])
        except Exception:
            pass
