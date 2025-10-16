from __future__ import annotations

from django.db import models
import uuid


class CapitalAdjustment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(db_index=True)
    label = models.CharField(max_length=120)
    currency = models.CharField(max_length=12, default='USD')
    amount = models.DecimalField(max_digits=18, decimal_places=6)
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        'users.User',
        null=True,
        blank=True,
        related_name='capital_adjustments',
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'capital_adjustments'
        verbose_name = 'تسوية رأس المال'
        verbose_name_plural = 'تسويات رأس المال'
        ordering = ['-created_at']

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.label} ({self.currency})"


class ReportsIndex(models.Model):
    class Meta:
        managed = False
        app_label = 'reports'
        verbose_name = 'تقرير'
        verbose_name_plural = 'التقارير'

    def __str__(self) -> str:  # pragma: no cover
        return "التقارير"
