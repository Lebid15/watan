from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone as dt_timezone
from typing import Iterable, Optional

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.legacy_models import LegacyUser
from apps.users.permissions import RequireAdminRole

from .models import Notification

UUID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")


@dataclass
class Cursor:
    created_at: datetime
    identifier: str


def _normalize_uuid(value: object | None) -> Optional[str]:
    if not value:
        return None
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def _decode_cursor(raw: Optional[str]) -> Optional[Cursor]:
    if not raw:
        return None
    try:
        sep = raw.index("_")
    except ValueError:
        return None
    ts_part, id_part = raw[:sep], raw[sep + 1 :]
    try:
        ts_val = int(ts_part)
    except ValueError:
        return None
    try:
        dt = datetime.fromtimestamp(ts_val / 1000.0, tz=dt_timezone.utc)
    except (ValueError, OSError):
        return None
    if not id_part:
        return None
    return Cursor(created_at=dt, identifier=id_part)


def _encode_cursor(notification: Notification) -> Optional[str]:
    created = notification.created_at
    if not created:
        return None
    if timezone.is_naive(created):
        created = timezone.make_aware(created, timezone=dt_timezone.utc)
    millis = int(created.timestamp() * 1000)
    return f"{millis}_{notification.id}"


def _resolve_tenant_id(request) -> Optional[str]:
    tenant = getattr(request, "tenant", None)
    tenant_id = getattr(tenant, "id", None)
    norm = _normalize_uuid(tenant_id)
    if norm:
        return norm

    header_name = getattr(settings, "TENANT_HEADER", "HTTP_X_TENANT_HOST")
    raw_host = request.META.get(header_name) or request.META.get("HTTP_HOST")
    if raw_host:
        host = str(raw_host).split(":")[0]
        try:
            from apps.tenants.models import TenantDomain  # type: ignore

            domain = (
                TenantDomain.objects.filter(domain=host)
                .order_by("-is_primary")
                .only("tenant_id")
                .first()
            )
            norm = _normalize_uuid(getattr(domain, "tenant_id", None))
            if norm:
                return norm
        except Exception:
            pass

    direct_header = request.META.get("HTTP_X_TENANT_ID") or getattr(request, "headers", {}).get("X-Tenant-Id")
    norm = _normalize_uuid(direct_header)
    if norm:
        return norm

    user = getattr(request, "user", None)
    if user:
        norm = _normalize_uuid(getattr(user, "tenant_id", None))
        if norm:
            return norm
    return None


def _choose_legacy_user(request, tenant_id: Optional[str]) -> LegacyUser:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        raise PermissionDenied("Authentication required")

    qs = LegacyUser.objects.all()
    tenant_norm = _normalize_uuid(tenant_id)
    if tenant_norm:
        qs = qs.filter(tenant_id=tenant_norm)

    header_override = request.META.get("HTTP_X_LEGACY_USER_ID") or getattr(request, "headers", {}).get("X-Legacy-User-Id")
    header_norm = _normalize_uuid(header_override)
    if header_norm:
        obj = qs.filter(id=header_norm).first()
        if obj:
            return obj

    attr_candidates: Iterable[object] = (
        getattr(user, "legacy_user_id", None),
        getattr(user, "legacy_id", None),
        getattr(user, "legacy_uuid", None),
    )
    for candidate in attr_candidates:
        norm = _normalize_uuid(candidate)
        if not norm:
            continue
        obj = qs.filter(id=norm).first()
        if obj:
            return obj

    email = (getattr(user, "email", "") or "").strip()
    if email:
        obj = qs.filter(email__iexact=email).first()
        if obj:
            return obj

    username = (getattr(user, "username", "") or "").strip()
    if username:
        obj = qs.filter(username__iexact=username).first()
        if obj:
            return obj

    # Fallback: search without tenant constraint, then validate tenant match
    fallback_qs = LegacyUser.objects.all()
    if email:
        candidate = fallback_qs.filter(email__iexact=email).first()
        if candidate and (not tenant_norm or _normalize_uuid(candidate.tenant_id) == tenant_norm):
            return candidate
    if username:
        candidate = fallback_qs.filter(username__iexact=username).first()
        if candidate and (not tenant_norm or _normalize_uuid(candidate.tenant_id) == tenant_norm):
            return candidate

    raise NotFound("المستخدم غير موجود ضمن هذا المستأجر")


def _serialize_notifications(rows: Iterable[Notification]) -> list[dict[str, object | None]]:
    return [row.to_dict() for row in rows]


def _paginated_list(
    legacy_user: LegacyUser,
    tenant_id: Optional[str],
    limit: int,
    cursor: Optional[Cursor],
) -> tuple[list[Notification], bool, Optional[str]]:
    tenant_norm = _normalize_uuid(tenant_id) or _normalize_uuid(getattr(legacy_user, "tenant_id", None))
    qs = Notification.objects.filter(user_id=str(legacy_user.id))
    if tenant_norm:
        qs = qs.filter(tenant_id=tenant_norm)

    if cursor:
        qs = qs.filter(
            Q(created_at__lt=cursor.created_at)
            | (Q(created_at=cursor.created_at) & Q(id__lt=cursor.identifier))
        )

    qs = qs.order_by("-created_at", "-id")
    rows = list(qs[: limit + 1])
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]
    next_cursor = _encode_cursor(rows[-1]) if has_more and rows else None
    return rows, has_more, next_cursor


def _basic_list(legacy_user: LegacyUser, tenant_id: Optional[str], cap: int = 200) -> list[Notification]:
    tenant_norm = _normalize_uuid(tenant_id) or _normalize_uuid(getattr(legacy_user, "tenant_id", None))
    qs = Notification.objects.filter(user_id=str(legacy_user.id))
    if tenant_norm:
        qs = qs.filter(tenant_id=tenant_norm)
    return list(qs.order_by("-created_at", "-id")[:cap])


class NotificationsMyView(APIView):
    permission_classes = [IsAuthenticated]
    force_paginated = False

    def get(self, request):
        tenant_id = _resolve_tenant_id(request)
        cursor_raw = request.query_params.get("cursor")
        limit_raw = request.query_params.get("limit")
        wants_paginated = self.force_paginated or bool(cursor_raw or limit_raw)
        try:
            legacy_user = _choose_legacy_user(request, tenant_id)
        except NotFound:
            if wants_paginated:
                limit = 20
                try:
                    limit = int(limit_raw) if limit_raw else 20
                except ValueError:
                    limit = 20
                limit = max(1, min(100, limit))
                return Response(
                    {
                        "items": [],
                        "pageInfo": {"nextCursor": None, "hasMore": False},
                        "meta": {"limit": limit},
                    }
                )
            return Response([])

        if wants_paginated:
            try:
                limit = int(limit_raw) if limit_raw else 20
            except ValueError:
                raise ValidationError("limit must be an integer")
            limit = max(1, min(100, limit))
            cursor = _decode_cursor(cursor_raw)
            rows, has_more, next_cursor = _paginated_list(legacy_user, tenant_id, limit, cursor)
            data = _serialize_notifications(rows)
            return Response(
                {
                    "items": data,
                    "pageInfo": {"nextCursor": next_cursor, "hasMore": has_more},
                    "meta": {"limit": limit},
                }
            )

        rows = _basic_list(legacy_user, tenant_id)
        return Response(_serialize_notifications(rows))


class NotificationsMineView(NotificationsMyView):
    force_paginated = True


class NotificationsRootView(NotificationsMineView):
    pass


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        tenant_id = _resolve_tenant_id(request)
        try:
            legacy_user = _choose_legacy_user(request, tenant_id)
        except NotFound:
            return Response({"ok": True, "updated": 0})
        tenant_norm = _normalize_uuid(tenant_id) or _normalize_uuid(getattr(legacy_user, "tenant_id", None))

        qs = Notification.objects.filter(user_id=str(legacy_user.id), is_read=False)
        if tenant_norm:
            qs = qs.filter(tenant_id=tenant_norm)
        updated = qs.update(is_read=True, read_at=timezone.now())
        return Response({"ok": True, "updated": updated})


class NotificationMarkOneReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk: uuid.UUID):
        tenant_id = _resolve_tenant_id(request)
        legacy_user = _choose_legacy_user(request, tenant_id)
        try:
            notification = Notification.objects.get(pk=pk)
        except Notification.DoesNotExist as exc:
            raise NotFound("التنبيه غير موجود") from exc

        tenant_norm = _normalize_uuid(tenant_id) or _normalize_uuid(getattr(legacy_user, "tenant_id", None))
        if tenant_norm and _normalize_uuid(notification.tenant_id) != tenant_norm:
            raise NotFound("التنبيه غير موجود")

        if str(notification.user_id) != str(legacy_user.id):
            raise PermissionDenied("لا تملك صلاحية تعديل هذا التنبيه")

        if not notification.is_read:
            notification.mark_read()
            notification.save(update_fields=["is_read", "read_at"])
        return Response(notification.to_dict())


class NotificationsAnnounceView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def post(self, request):
        tenant_id = _resolve_tenant_id(request)
        tenant_norm = _normalize_uuid(tenant_id)
        if not tenant_norm:
            raise ValidationError("TENANT_ID_REQUIRED")

        title = (request.data.get("title") or "").strip()
        message = (request.data.get("message") or "").strip()
        if not title or not message:
            raise ValidationError("العنوان والنص مطلوبان")

        link = (request.data.get("link") or None) or None
        channel = (request.data.get("channel") or "in_app").strip() or "in_app"
        priority = (request.data.get("priority") or "normal").strip() or "normal"

        users = list(
            LegacyUser.objects.filter(tenant_id=tenant_norm, is_active=True).only("id", "tenant_id")
        )
        if not users:
            return Response({"ok": True, "created": 0})

        now = timezone.now()
        payload = [
            Notification(
                tenant_id=tenant_norm,
                user=user,
                type="announcement",
                title=title,
                message=message,
                meta=None,
                is_read=False,
                read_at=None,
                link=link,
                channel=channel,
                priority=priority,
                created_at=now,
            )
            for user in users
        ]

        with transaction.atomic():
            Notification.objects.bulk_create(payload)
        return Response({"ok": True, "created": len(payload)})
