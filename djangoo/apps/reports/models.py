from __future__ import annotations

from django.db import models


class ReportsIndex(models.Model):
    class Meta:
        managed = False
        app_label = 'reports'
        verbose_name = 'تقرير'
        verbose_name_plural = 'التقارير'

    def __str__(self) -> str:  # pragma: no cover
        return "التقارير"
