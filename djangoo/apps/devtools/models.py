from __future__ import annotations

from django.db import models


class DevPanel(models.Model):
    class Meta:
        managed = False
        app_label = 'devtools'
        # Rename the entry shown in Django Admin from "Developer tools" to "التنبيهات"
        verbose_name = 'التنبيهات'
        verbose_name_plural = 'التنبيهات'

    def __str__(self) -> str:  # pragma: no cover
        return "التنبيهات"
