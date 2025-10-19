from __future__ import annotations

import uuid
from typing import Any

from django.db.models import Q
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ProductOrder


def _to_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _to_decimal_str(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def _iso(dt) -> str | None:
    if not dt:
        return None
    try:
        return dt.isoformat()
    except AttributeError:
        return None


class OrderTraceHealthView(APIView):
    """Read-only trace endpoint for chained orders (Phase 0)."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, id: uuid.UUID):
        order = self._get_order(id)
        payload = self._build_payload(order)
        return Response(payload)

    def _get_order(self, order_id: uuid.UUID) -> ProductOrder:
        try:
            return ProductOrder.objects.select_related(None).get(id=order_id)
        except ProductOrder.DoesNotExist as exc:
            raise NotFound("ORDER_NOT_FOUND") from exc

    def _build_payload(self, order: ProductOrder) -> dict[str, Any]:
        return {
            "order_id": str(order.id),
            "tenant_id": _to_str(order.tenant_id),
            "root_order_id": _to_str(getattr(order, "root_order_id", None)),
            "provider_id": order.provider_id,
            "external_order_id": order.external_order_id,
            "provider_referans": order.provider_referans,
            "mode": getattr(order, "mode", None),
            "cost_source": getattr(order, "cost_source", None),
            "cost_price_usd": _to_decimal_str(getattr(order, "cost_price_usd", None)),
            "chain_path": getattr(order, "chain_path", None),
            "status": order.status,
            "external_status": order.external_status,
            "fx_locked": bool(getattr(order, "fx_locked", False)),
            "created_at": _iso(order.created_at),
            "sent_at": _iso(order.sent_at),
            "last_sync_at": _iso(order.last_sync_at),
            "completed_at": _iso(order.completed_at),
            "approved_at": _iso(getattr(order, "approved_at", None)),
            "cost": self._serialize_cost(order),
            "messages": self._serialize_messages(order),
            "status_timeline": self._build_timeline(order),
            "upstream": self._serialize_upstream(order),
            "downstream": self._serialize_downstream(order),
        }

    def _serialize_cost(self, order: ProductOrder) -> dict[str, Any]:
        return {
            "currency": getattr(order, "cost_currency", None),
            "amount": _to_decimal_str(self._infer_cost_amount(order)),
            "usd_snapshot": _to_decimal_str(getattr(order, "cost_usd_at_order", None)),
            "try_snapshot": _to_decimal_str(getattr(order, "cost_try_at_order", None)),
            "sell_price_currency": getattr(order, "sell_price_currency", None),
            "sell_price_amount": _to_decimal_str(getattr(order, "sell_price_amount", None)),
            "price": _to_decimal_str(getattr(order, "price", None)),
            "sell_usd_at_order": _to_decimal_str(getattr(order, "sell_usd_at_order", None)),
            "profit_usd_at_order": _to_decimal_str(getattr(order, "profit_usd_at_order", None)),
            "profit_try_at_order": _to_decimal_str(getattr(order, "profit_try_at_order", None)),
            "fx_usd_try_at_order": _to_decimal_str(getattr(order, "fx_usd_try_at_order", None)),
            "cost_try_at_approval": _to_decimal_str(getattr(order, "cost_try_at_approval", None)),
            "sell_try_at_approval": _to_decimal_str(getattr(order, "sell_try_at_approval", None)),
            "profit_try_at_approval": _to_decimal_str(getattr(order, "profit_try_at_approval", None)),
            "profit_usd_at_approval": _to_decimal_str(getattr(order, "profit_usd_at_approval", None)),
            "fx_usd_try_at_approval": _to_decimal_str(getattr(order, "fx_usd_try_at_approval", None)),
        }

    def _infer_cost_amount(self, order: ProductOrder) -> Any:
        for attr in ("cost_amount", "cost_try_at_order", "cost_try_at_approval", "cost_usd_at_order"):
            value = getattr(order, attr, None)
            if value not in (None, ""):
                return value
        return None

    def _serialize_messages(self, order: ProductOrder) -> dict[str, Any]:
        return {
            "last_message": order.last_message,
            "provider_message": order.provider_message,
            "pin_code": order.pin_code,
            "manual_note": order.manual_note,
        }

    def _build_timeline(self, order: ProductOrder) -> list[dict[str, Any]]:
        timeline: list[dict[str, Any]] = []
        timeline.append(
            {
                "event": "created",
                "at": _iso(order.created_at),
                "status": order.status,
                "external_status": order.external_status,
            }
        )
        if order.sent_at:
            timeline.append(
                {
                    "event": "sent",
                    "at": _iso(order.sent_at),
                    "status": order.status,
                    "external_status": order.external_status,
                }
            )
        if order.last_sync_at:
            timeline.append(
                {
                    "event": "last_poll",
                    "at": _iso(order.last_sync_at),
                    "status": order.status,
                    "external_status": order.external_status,
                }
            )
        if order.completed_at:
            timeline.append(
                {
                    "event": "completed",
                    "at": _iso(order.completed_at),
                    "status": order.status,
                    "external_status": order.external_status,
                    "terminal": True,
                }
            )
        approved_at = getattr(order, "approved_at", None)
        if approved_at:
            timeline.append(
                {
                    "event": "approved",
                    "at": _iso(approved_at),
                    "status": order.status,
                    "external_status": order.external_status,
                    "terminal": order.status in {"approved", "rejected"},
                }
            )
        return timeline

    def _serialize_upstream(self, order: ProductOrder) -> list[dict[str, Any]]:
        related = (
            ProductOrder.objects.filter(
                Q(external_order_id=str(order.id)) | Q(provider_referans=str(order.id))
            )
            .order_by("created_at")
            .distinct()
        )
        return [self._link_summary(o) for o in related]

    def _serialize_downstream(self, order: ProductOrder) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for candidate in self._candidate_ids(order):
            try:
                downstream = ProductOrder.objects.get(id=candidate)
            except ProductOrder.DoesNotExist:
                results.append(
                    {
                        "id": candidate,
                        "exists": False,
                        "provider_id": None,
                        "external_order_id": None,
                        "provider_referans": None,
                        "status": None,
                        "external_status": None,
                    }
                )
            else:
                entry = self._link_summary(downstream)
                entry["exists"] = True
                results.append(entry)
        return results

    def _candidate_ids(self, order: ProductOrder) -> list[str]:
        ids: list[str] = []
        for raw in (order.external_order_id, order.provider_referans):
            try:
                candidate = uuid.UUID(str(raw))
            except (TypeError, ValueError, AttributeError):
                continue
            candidate_str = str(candidate)
            if candidate_str == str(order.id):
                continue
            if candidate_str not in ids:
                ids.append(candidate_str)
        return ids

    def _link_summary(self, order: ProductOrder) -> dict[str, Any]:
        return {
            "id": str(order.id),
            "tenant_id": _to_str(order.tenant_id),
            "provider_id": order.provider_id,
            "external_order_id": order.external_order_id,
            "provider_referans": order.provider_referans,
            "status": order.status,
            "external_status": order.external_status,
        }
