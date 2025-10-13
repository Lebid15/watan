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


def try_auto_dispatch(order_id: str, tenant_id: Optional[str] = None) -> None:
    """
    محاولة إرسال الطلب تلقائياً للمزود الخارجي حسب إعدادات التوجيه (package_routing).
    
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
    print(f"🚀 AUTO-DISPATCH START: Order ID = {order_id}")
    print(f"{'='*80}\n")
    
    try:
        # 1. جلب الطلب مع العلاقات
        print(f"📦 Step 1: Fetching order...")
        order = ProductOrder.objects.select_related('user', 'package', 'product').get(id=order_id)
        print(f"   ✅ Order found: {order_id}")
        print(f"   - Status: {order.status}")
        print(f"   - Package ID: {order.package_id}")
        print(f"   - Product ID: {order.product_id}")
        print(f"   - User Identifier: {order.user_identifier}")
        print(f"   - Extra Field: {order.extra_field}")
        print(f"   - Quantity: {order.quantity}")
    except ProductOrder.DoesNotExist:
        print(f"   ❌ Order not found: {order_id}")
        logger.warning("Auto-dispatch: Order not found", extra={"order_id": order_id})
        return
    
    # التحقق من المستأجر
    print(f"\n📋 Step 2: Verifying tenant...")
    if tenant_id and str(order.tenant_id) != str(tenant_id):
        print(f"   ❌ Tenant mismatch!")
        print(f"   - Expected: {tenant_id}")
        print(f"   - Actual: {order.tenant_id}")
        logger.warning("Auto-dispatch: Tenant mismatch", extra={
            "order_id": order_id,
            "expected_tenant": tenant_id,
            "actual_tenant": str(order.tenant_id)
        })
        return
    
    effective_tenant_id = str(order.tenant_id)
    print(f"   ✅ Tenant verified: {effective_tenant_id}")
    
    # 2. التحقق من أن الطلب لم يُرسل بعد
    print(f"\n🔍 Step 3: Checking if order was already dispatched...")
    if order.provider_id or order.external_order_id or order.status != 'pending':
        print(f"   ⚠️ Order already dispatched or not pending - SKIPPING")
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
    print(f"   ✅ Order is pending and not yet dispatched")
    
    # 3. جلب إعدادات التوجيه للباقة
    print(f"\n⚙️ Step 4: Loading PackageRouting configuration...")
    print(f"   - Package ID: {order.package_id}")
    print(f"   - Tenant ID: {effective_tenant_id}")
    try:
        routing = PackageRouting.objects.get(
            package_id=order.package_id,
            tenant_id=effective_tenant_id
        )
        print(f"   ✅ PackageRouting found!")
        print(f"   - Mode: {routing.mode}")
        print(f"   - Provider Type: {routing.provider_type}")
        print(f"   - Primary Provider ID: {routing.primary_provider_id}")
    except PackageRouting.DoesNotExist:
        print(f"   ❌ No PackageRouting configured - SKIPPING")
        logger.debug("Auto-dispatch: No routing configured", extra={
            "order_id": order_id,
            "package_id": str(order.package_id),
            "tenant_id": effective_tenant_id
        })
        return
    
    # 4. التحقق من إعدادات التوجيه التلقائي
    print(f"\n✓ Step 5: Validating routing configuration...")
    if routing.mode != 'auto':
        print(f"   ⚠️ Routing mode is NOT 'auto' (it's '{routing.mode}') - SKIPPING")
        logger.debug("Auto-dispatch: Routing mode is not auto", extra={
            "order_id": order_id,
            "mode": routing.mode
        })
        return
    print(f"   ✅ Mode is 'auto'")
    
    if routing.provider_type != 'external':
        print(f"   ⚠️ Provider type is NOT 'external' (it's '{routing.provider_type}') - SKIPPING")
        logger.debug("Auto-dispatch: Provider type is not external", extra={
            "order_id": order_id,
            "provider_type": routing.provider_type
        })
        return
    print(f"   ✅ Provider type is 'external'")
    
    if not routing.primary_provider_id:
        print(f"   ❌ No primary provider configured - SKIPPING")
        logger.debug("Auto-dispatch: No primary provider configured", extra={
            "order_id": order_id
        })
        return
    
    provider_id = routing.primary_provider_id
    print(f"   ✅ Primary Provider ID: {provider_id}")
    
    # 5. جلب معلومات الـ mapping
    print(f"\n🔗 Step 6: Loading PackageMapping...")
    print(f"   - Our Package ID: {order.package_id}")
    print(f"   - Provider ID: {provider_id}")
    try:
        mapping = PackageMapping.objects.get(
            our_package_id=order.package_id,
            provider_api_id=provider_id,
            tenant_id=effective_tenant_id
        )
        print(f"   ✅ PackageMapping found!")
        print(f"   - Provider Package ID: {mapping.provider_package_id}")
    except PackageMapping.DoesNotExist:
        print(f"   ❌ No PackageMapping found - CANNOT DISPATCH!")
        logger.warning("Auto-dispatch: No mapping found", extra={
            "order_id": order_id,
            "package_id": str(order.package_id),
            "provider_id": provider_id
        })
        return
    
    provider_package_id = mapping.provider_package_id
    
    # 6. جلب معلومات Integration للمزود
    print(f"\n🔌 Step 7: Loading Integration details...")
    try:
        integration = Integration.objects.get(id=provider_id, tenant_id=effective_tenant_id)
        print(f"   ✅ Integration found!")
        print(f"   - Provider: {integration.provider}")
        print(f"   - Base URL: {integration.base_url}")
        print(f"   - Has kod: {bool(getattr(integration, 'kod', None))}")
        print(f"   - Has sifre: {bool(getattr(integration, 'sifre', None))}")
    except Integration.DoesNotExist:
        print(f"   ❌ Integration not found - CANNOT DISPATCH!")
        logger.warning("Auto-dispatch: Integration not found", extra={
            "order_id": order_id,
            "provider_id": provider_id
        })
        return
    
    # 7. إعداد الـ adapter والـ credentials
    print(f"\n🔑 Step 8: Resolving adapter credentials...")
    binding, creds = resolve_adapter_credentials(
        integration.provider,
        base_url=integration.base_url,
        api_token=getattr(integration, 'api_token', None),
        kod=getattr(integration, 'kod', None),
        sifre=getattr(integration, 'sifre', None),
    )
    
    if not binding or not creds:
        print(f"   ❌ Could not resolve adapter credentials - CANNOT DISPATCH!")
        logger.warning("Auto-dispatch: Could not resolve adapter credentials", extra={
            "order_id": order_id,
            "provider": integration.provider
        })
        return
    
    print(f"   ✅ Adapter credentials resolved!")
    print(f"   - Adapter: {binding.adapter.__class__.__name__}")
    print(f"   - Credentials type: {type(creds).__name__}")
    
    # 8. إعداد payload للإرسال
    print(f"\n📤 Step 9: Building payload...")
    
    # جلب معلومات المنتج من المزود للحصول على oyun و kupur
    print(f"   📡 Fetching provider products to get metadata...")
    try:
        provider_products = binding.adapter.list_products(creds)
        print(f"   ✅ Got {len(provider_products)} products from provider")
        
        # طباعة أول 3 منتجات لفهم الـ structure
        print(f"\n   📋 Sample products from provider (first 3):")
        for i, p in enumerate(provider_products[:3]):
            print(f"      Product {i+1}:")
            print(f"         - externalId: {p.get('externalId')}")
            print(f"         - name: {p.get('name')}")
            print(f"         - meta: {p.get('meta')}")
            if i >= 2:
                break
        
        print(f"\n   🔍 Looking for packageExternalId = '{provider_package_id}'...")
        
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
            print(f"   ✅ Found matching product in provider catalog!")
            print(f"      Matched product details:")
            print(f"         - externalId: {matched_product.get('externalId')}")
            print(f"         - name: {matched_product.get('name')}")
            print(f"         - meta: {matched_product.get('meta')}")
            
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
            print(f"   ❌ Product NOT found in provider catalog!")
            print(f"      Will use provider_package_id as fallback for both oyun and kupur")
            # استخدام القيم الافتراضية
            oyun = str(provider_package_id)
            kupur = str(provider_package_id)
    except Exception as e:
        print(f"   ⚠️ Could not fetch provider products: {e}")
        print(f"   Will use provider_package_id as fallback")
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
    
    print(f"   ✅ Payload built:")
    print(f"   - Product ID: {payload['productId']}")
    print(f"   - Quantity: {payload['qty']}")
    print(f"   - Order ID (referans): {payload['orderId']}")
    print(f"   - User Identifier: {payload.get('userIdentifier', 'N/A')}")
    print(f"   - Extra Field: {payload.get('extraField', 'N/A')}")
    print(f"   - Params: {payload['params']}")
    print(f"   - Full payload: {payload}")
    
    # 9. جلب معلومات التكلفة (اختياري)
    print(f"\n💰 Step 10: Loading cost information...")
    cost_currency = 'USD'
    cost_amount = Decimal('0')
    try:
        cost_row = PackageCost.objects.get(
            package_id=order.package_id,
            provider_id=provider_id,
            tenant_id=effective_tenant_id
        )
        cost_currency = cost_row.cost_currency or 'USD'
        cost_amount = Decimal(str(cost_row.cost_amount or 0))
        print(f"   ✅ PackageCost found: {cost_amount} {cost_currency}")
    except PackageCost.DoesNotExist:
        # fallback إلى base_price من الباقة
        if order.package:
            try:
                from apps.products.models import ProductPackage
                pkg = ProductPackage.objects.get(id=order.package_id)
                cost_amount = Decimal(str(pkg.base_price or pkg.capital or 0))
                print(f"   ⚠️ No PackageCost, using package base_price: {cost_amount} {cost_currency}")
            except Exception:
                print(f"   ⚠️ Could not load cost info, using 0")
                pass
    
    # 10. إرسال الطلب للمزود
    try:
        print(f"\n🚀 Step 11: SENDING ORDER TO PROVIDER...")
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
        
        # استدعاء place_order من الـ adapter
        print(f"\n   📡 Calling adapter.place_order()...")
        result = binding.adapter.place_order(creds, str(provider_package_id), payload)
        print(f"   ✅ Provider responded!")
        print(f"   - Response: {result}")
        
        # 11. معالجة النتيجة وتحديث الطلب
        print(f"\n📝 Step 12: Processing provider response...")
        external_order_id = result.get('externalOrderId') or str(order.id)
        status_raw = result.get('status') or result.get('providerStatus') or 'sent'
        note = result.get('note') or result.get('message') or 'sent'
        provider_referans = result.get('providerReferans') or result.get('referans') or str(order.id)
        
        print(f"   - External Order ID: {external_order_id}")
        print(f"   - Status (raw): {status_raw}")
        print(f"   - Note: {note}")
        print(f"   - Provider Referans: {provider_referans}")
        
        # تحديد external_status
        external_status = 'processing'
        if status_raw in ['sent', 'accepted', 'queued', 'queue']:
            external_status = 'sent'
        elif status_raw in ['completed', 'done', 'success']:
            external_status = 'completed'
        elif status_raw in ['failed', 'rejected', 'error']:
            external_status = 'failed'
        
        print(f"   - External Status (mapped): {external_status}")
        
        # الحصول على التكلفة والرصيد من النتيجة إذا توفرت
        if result.get('cost') is not None:
            try:
                cost_amount = Decimal(str(result['cost']))
                print(f"   - Cost from provider: {cost_amount}")
            except Exception:
                pass
        
        if result.get('balance') is not None:
            print(f"   - Provider balance: {result.get('balance')}")
            # يمكن تحديث رصيد المزود هنا إذا أردنا
            pass
        
        # تحديث الطلب
        print(f"\n💾 Step 13: Updating order in database...")
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
                        provider_referans = %s
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
                    str(order.id)
                ])
        except Exception as e:
            # If provider_referans column doesn't exist, update without it
            print(f"   ⚠️ Could not save provider_referans (column may not exist yet): {e}")
            print(f"   📝 Saving order without provider_referans...")
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
                        "costAmount" = %s
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
                    str(order.id)
                ])
        
        print(f"   ✅ Order updated in database")
        print(f"   - Provider ID: {provider_id}")
        print(f"   - External Order ID: {external_order_id}")
        print(f"   - External Status: {external_status}")
        print(f"   - Provider Referans: {provider_referans}")
        print(f"   - Sent At: {now}")
        
        # إضافة ملاحظة للطلب
        print(f"\n📋 Step 14: Adding note to order...")
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
            print(f"   ✅ Note added to order")
        except Exception as e:
            print(f"   ⚠️ Failed to add note: {e}")
            logger.warning("Failed to add auto-dispatch note", extra={
                "order_id": order_id,
                "error": str(e)
            })
        
        print(f"\n{'='*80}")
        print(f"✅ AUTO-DISPATCH SUCCESS!")
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
        
        # 📋 Step 15: Schedule status check
        print(f"\n⏰ Step 15: Scheduling status check...")
        try:
            from .tasks import check_order_status
            
            # Schedule status check to run after 10 seconds
            task = check_order_status.apply_async(
                args=[str(order.id), str(effective_tenant_id)],
                countdown=10  # Start checking after 10 seconds
            )
            print(f"   ✅ Status check scheduled!")
            print(f"   - Task ID: {task.id}")
            print(f"   - Will start in: 10 seconds")
            print(f"   - Will retry every 10 seconds until completed")
            
            logger.info("Auto-dispatch: Status check task scheduled", extra={
                "order_id": order_id,
                "task_id": str(task.id),
                "countdown": 10
            })
        except Exception as e:
            print(f"   ⚠️ Failed to schedule status check: {e}")
            logger.warning("Auto-dispatch: Failed to schedule status check", extra={
                "order_id": order_id,
                "error": str(e)
            })
        
    except Exception as e:
        print(f"\n{'='*80}")
        print(f"❌ AUTO-DISPATCH FAILED!")
        print(f"   Order: {order_id}")
        print(f"   Error Type: {type(e).__name__}")
        print(f"   Error Message: {str(e)}")
        print(f"{'='*80}\n")
        
        import traceback
        print(f"📋 Full traceback:")
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
