from __future__ import annotations

from django.db import models


class AlertsPanel(models.Model):
    class Meta:
        managed = False
        app_label = 'devtools'
        verbose_name = 'التنبيهات'
        verbose_name_plural = 'التنبيهات'

    def __str__(self) -> str:  # pragma: no cover
        return "التنبيهات"


class SecurityPanel(models.Model):
    class Meta:
        managed = False
        app_label = 'devtools'
        verbose_name = 'الأمان'
        verbose_name_plural = 'الأمان'

    def __str__(self) -> str:  # pragma: no cover
        return "الأمان"


class MaintenancePanel(models.Model):
    class Meta:
        managed = False
        app_label = 'devtools'
        verbose_name = 'وضع الصيانة'
        verbose_name_plural = 'وضع الصيانة'

    def __str__(self) -> str:  # pragma: no cover
        return "وضع الصيانة"
