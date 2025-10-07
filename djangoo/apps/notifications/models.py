from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_column="tenantId")
    user = models.ForeignKey(
        "users.LegacyUser",
        db_column="user_id",
        on_delete=models.DO_NOTHING,
        related_name="notifications",
    )
    type = models.CharField(max_length=40, db_column="type", default="announcement")
    title = models.CharField(max_length=200, db_column="title", null=True, blank=True)
    message = models.TextField(db_column="message")
    meta = models.JSONField(db_column="meta", null=True, blank=True)
    is_read = models.BooleanField(db_column="isRead", default=False)
    read_at = models.DateTimeField(db_column="readAt", null=True, blank=True)
    link = models.CharField(max_length=300, db_column="link", null=True, blank=True)
    channel = models.CharField(max_length=20, db_column="channel", default="in_app")
    priority = models.CharField(max_length=10, db_column="priority", default="normal")
    created_at = models.DateTimeField(db_column="createdAt", default=timezone.now)

    class Meta:
        managed = False
        db_table = "notifications"
        ordering = ["-created_at", "-id"]

    def mark_read(self) -> None:
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()

    def to_dict(self) -> dict[str, object | None]:
        created = self.created_at
        if created is not None and timezone.is_naive(created):
            created = timezone.make_aware(created, timezone=timezone.utc)
        iso_created = created.isoformat() if created else None
        return {
            "id": str(self.id),
            "title": self.title,
            "message": self.message,
            "link": self.link,
            "isRead": bool(self.is_read),
            "createdAt": iso_created,
        }
