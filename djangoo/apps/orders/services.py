from __future__ import annotations

import datetime
import logging
from dataclasses import dataclass
import json
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Optional

from django.db import transaction, connection
from django.db.models import Q

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


LEGACY_QUANT = Decimal("0.01")
DJANGO_QUANT = Decimal("0.000001")


def _as_decimal(value: object) -> Decimal:
    try:
        return Decimal(value)
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def _quantize(value: Decimal, quantum: Decimal) -> Decimal:
    return value.quantize(quantum, rounding=ROUND_HALF_UP)


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

                delta = -amount_user_dec

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
    
    # Calculate costTryAtApproval from package capital/base_price
    base_usd = Decimal('0')
    if order.package:
        try:
            pkg = ProductPackage.objects.get(id=order.package_id)
            base_usd = Decimal(str(pkg.base_price or pkg.capital or 0))
        except ProductPackage.DoesNotExist:
            pass
    
    qty = Decimal(str(order.quantity or 1))
    cost_try_at_approval = _quantize(base_usd * qty * fx_usd_try, Decimal('0.01'))
    
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
