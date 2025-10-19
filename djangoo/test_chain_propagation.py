#!/usr/bin/env python
"""Run Phase 3 chain propagation smoke tests."""
import json
import os
import sys
import uuid
from datetime import datetime
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import django
from django.db import transaction
from django.utils import timezone

django.setup()

from apps.orders.models import OrderDispatchLog, ProductOrder
from apps.orders.services import _propagate_chain_status

TENANT_DIANA = uuid.UUID("3bb215a4-4363-4497-8c97-c5451dafce7d")
TENANT_ALSHAM = uuid.UUID("7d37f00a-22f3-4e61-88d7-2a97b79d86fb")
TENANT_SHAMTECH = uuid.UUID("fd0a6cce-f6e7-4c67-aa6c-a19fcac96536")
TENANT_KHALIL = uuid.UUID("df26e40e-8143-4620-865c-f82f5181c45b")

PACKAGE_PUBG660 = uuid.UUID("9d94aa49-6c7a-4dd2-bbfd-a8ed3c7079d9")
PRODUCT_PUBG = uuid.UUID("b8c30a6d-76c8-4a18-9079-d8c892168c96")
PROVIDER_SHAMTECH = "71544f6c-705e-4e7f-bc3c-c24dc90428b7"

ORDER_DIANA_PARENT_ID = uuid.UUID("12345678-1234-5678-1234-567812345678")
ORDER_DIANA_CHILD_ID = uuid.UUID("abcdef01-2345-6789-abcd-ef0123456789")
ORDER_KHALIL_ROOT_ID = uuid.UUID("f7304800-0000-4000-9000-00f730480000")
ORDER_ALSHAM_MID_ID = uuid.UUID("7cfb136b-6d86-4fb1-ad70-5e275f472f15")
ORDER_SHAMTECH_LEAF_ID = uuid.UUID("4adefa00-0000-4000-a000-004adefa0000")


def _iso(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    try:
        return value.isoformat()
    except AttributeError:
        return None


def _order_snapshot(order: ProductOrder) -> dict:
    return {
        "id": str(order.id),
        "tenant_id": str(order.tenant_id) if order.tenant_id else None,
        "status": order.status,
        "external_status": order.external_status,
        "provider_id": order.provider_id,
        "manual_note": order.manual_note,
        "fx_locked": bool(getattr(order, "fx_locked", False)),
        "completed_at": _iso(order.completed_at),
        "approved_at": _iso(getattr(order, "approved_at", None)),
        "last_sync_at": _iso(order.last_sync_at),
        "external_order_id": order.external_order_id,
        "provider_referans": order.provider_referans,
    }


def _log_entries(order_ids):
    logs = (
        OrderDispatchLog.objects.filter(order_id__in=[str(oid) for oid in order_ids], action="CHAIN_STATUS")
        .order_by("id")
        .values("order_id", "action", "result", "payload_snapshot", "created_at")
    )
    formatted = []
    for entry in logs:
        payload = entry["payload_snapshot"] or {}
        formatted.append(
            {
                "order_id": entry["order_id"],
                "created_at": _iso(entry["created_at"]),
                "origin": payload.get("origin"),
                "source_order_id": payload.get("source_order_id"),
                "updated_fields": payload.get("updated_fields"),
            }
        )
    return formatted


def _create_order(*, order_id: uuid.UUID, tenant_id: uuid.UUID, root_order: ProductOrder | None = None,
                  external_order_id: uuid.UUID | None = None, provider_referans: uuid.UUID | None = None,
                  status: str = "pending", manual_note: str | None = None, label: str = "") -> ProductOrder:
    now = timezone.now()
    return ProductOrder.objects.create(
        id=order_id,
        tenant_id=tenant_id,
        product_id=PRODUCT_PUBG,
        package_id=PACKAGE_PUBG660,
        status=status,
        price=Decimal("150.00"),
        sell_price_amount=Decimal("150.00"),
        sell_price_currency="USD",
        created_at=now,
        user_identifier=f"chain-test-{label}",
        extra_field=f"chain-test-{label}",
        notes=[],
        manual_note=manual_note,
        external_status="not_sent",
        external_order_id=str(external_order_id) if external_order_id else None,
        provider_referans=str(provider_referans) if provider_referans else None,
        root_order=root_order,
    )


def _purge(order_ids):
    OrderDispatchLog.objects.filter(order_id__in=[str(oid) for oid in order_ids]).delete()
    ProductOrder.objects.filter(id__in=order_ids).delete()


def run_scenario_diana() -> dict:
    order_ids = [ORDER_DIANA_PARENT_ID, ORDER_DIANA_CHILD_ID]
    _purge(order_ids)

    with transaction.atomic():
        parent = _create_order(
            order_id=ORDER_DIANA_PARENT_ID,
            tenant_id=TENANT_DIANA,
            status="pending",
            manual_note="parent awaiting vendor",
            label="diana-root",
        )

        child = _create_order(
            order_id=ORDER_DIANA_CHILD_ID,
            tenant_id=TENANT_SHAMTECH,
            root_order=parent,
            provider_referans=parent.id,
            status="pending",
            label="diana-shamtech",
        )

        parent.external_order_id = str(child.id)
        parent.save(update_fields=["external_order_id"])

        before_parent = _order_snapshot(parent)

        now = timezone.now()
        child.status = "approved"
        child.external_status = "delivered"
        child.provider_id = PROVIDER_SHAMTECH
        child.manual_note = "CODE-CHAIN-1"
        child.last_sync_at = now
        child.completed_at = now
        child.approved_at = now
        child.approved_local_date = now.date()
        child.approved_local_month = now.strftime("%Y-%m")
        child.fx_locked = True
        child.save(
            update_fields=[
                "status",
                "external_status",
                "provider_id",
                "manual_note",
                "last_sync_at",
                "completed_at",
                "approved_at",
                "approved_local_date",
                "approved_local_month",
                "fx_locked",
            ]
        )

        _propagate_chain_status(child, origin="test_diana_chain")

    parent.refresh_from_db()
    child.refresh_from_db()
    after_parent = _order_snapshot(parent)
    after_child = _order_snapshot(child)

    logs = _log_entries(order_ids)

    return {
        "scenario": "Diana → ShamTech",
        "order_ids": [str(oid) for oid in order_ids],
        "before": {"parent": before_parent},
        "after": {"parent": after_parent, "child": after_child},
        "logs": logs,
    }


def run_scenario_khalil() -> dict:
    order_ids = [ORDER_KHALIL_ROOT_ID, ORDER_ALSHAM_MID_ID, ORDER_SHAMTECH_LEAF_ID]
    _purge(order_ids)

    with transaction.atomic():
        root = _create_order(
            order_id=ORDER_KHALIL_ROOT_ID,
            tenant_id=TENANT_KHALIL,
            status="pending",
            manual_note="customer waiting",
            label="khalil-customer",
        )

        middle = _create_order(
            order_id=ORDER_ALSHAM_MID_ID,
            tenant_id=TENANT_ALSHAM,
            root_order=root,
            provider_referans=root.id,
            status="pending",
            label="khalil-alsham",
        )

        leaf = _create_order(
            order_id=ORDER_SHAMTECH_LEAF_ID,
            tenant_id=TENANT_SHAMTECH,
            root_order=root,
            provider_referans=middle.id,
            status="pending",
            label="khalil-shamtech",
        )

        root.external_order_id = str(middle.id)
        middle.external_order_id = str(leaf.id)
        root.save(update_fields=["external_order_id"])
        middle.save(update_fields=["external_order_id"])

        before = {
            "root": _order_snapshot(root),
            "middle": _order_snapshot(middle),
        }

        now = timezone.now()
        leaf.status = "approved"
        leaf.external_status = "delivered"
        leaf.provider_id = PROVIDER_SHAMTECH
        leaf.manual_note = "CODE-CHAIN-2"
        leaf.last_sync_at = now
        leaf.completed_at = now
        leaf.approved_at = now
        leaf.approved_local_date = now.date()
        leaf.approved_local_month = now.strftime("%Y-%m")
        leaf.fx_locked = True
        leaf.save(
            update_fields=[
                "status",
                "external_status",
                "provider_id",
                "manual_note",
                "last_sync_at",
                "completed_at",
                "approved_at",
                "approved_local_date",
                "approved_local_month",
                "fx_locked",
            ]
        )

        _propagate_chain_status(leaf, origin="test_khalil_chain")

    root.refresh_from_db()
    middle.refresh_from_db()
    leaf.refresh_from_db()

    after = {
        "root": _order_snapshot(root),
        "middle": _order_snapshot(middle),
        "leaf": _order_snapshot(leaf),
    }

    logs = _log_entries(order_ids)

    return {
        "scenario": "Khalil → Al-Sham → ShamTech",
        "order_ids": [str(oid) for oid in order_ids],
        "before": before,
        "after": after,
        "logs": logs,
    }


def main():
    results = [run_scenario_diana(), run_scenario_khalil()]
    print(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    main()
