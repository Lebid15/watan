from __future__ import annotations

from django.db import models


class Payout(models.Model):
    class Meta:
        db_table = 'payout'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True, null=True)
    user_id = models.UUIDField(db_column='userId', db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10)
    status = models.CharField(max_length=20)  # pending|approved|rejected|sent
    notes = models.JSONField(null=True)
    notes_count = models.IntegerField(db_column='notesCount', null=True)
    external_ref = models.CharField(max_length=120, null=True, db_column='externalRef')
    manual_note = models.TextField(null=True, db_column='manualNote')
    sent_at = models.DateTimeField(db_column='sentAt', null=True)
    completed_at = models.DateTimeField(db_column='completedAt', null=True)
    created_at = models.DateTimeField(db_column='createdAt')
    updated_at = models.DateTimeField(db_column='updatedAt', null=True)