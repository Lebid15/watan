import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        SUSPENDED = "suspended", _("Suspended")
        DISABLED = "disabled", _("Disabled")

    class Roles(models.TextChoices):
        DEVELOPER = "developer", _("Developer")
        INSTANCE_OWNER = "instance_owner", _("Instance Owner")
        DISTRIBUTOR = "distributor", _("Distributor")
        END_USER = "end_user", _("End User")

    balance = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    currency = models.CharField(max_length=10, default="USD")
    api_token = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    overdraft = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    role = models.CharField(max_length=32, choices=Roles.choices, default=Roles.END_USER)
    force_totp_enroll = models.BooleanField(default=False)
    totp_failed_attempts = models.PositiveIntegerField(default=0)
    totp_locked_until = models.DateTimeField(null=True, blank=True)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    full_name = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=64, blank=True)
    country_code = models.CharField(max_length=32, blank=True)
    price_group_id = models.UUIDField(null=True, blank=True)
    preferred_currency_code = models.CharField(max_length=10, blank=True)
    legacy_password_hash = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'dj_users'
        verbose_name = 'مستخدم'
        verbose_name_plural = 'المستخدمون'

    def __str__(self):
        return self.username


class TotpCredential(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='totp_credentials',
    )
    tenant_id = models.UUIDField(null=True, blank=True)
    encrypted_secret = models.CharField(max_length=200)
    label = models.CharField(max_length=100, null=True, blank=True)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    usage_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'dj_totp_credentials'
        indexes = [
            models.Index(fields=['user'], name='dj_totp_user_idx'),
            models.Index(fields=['tenant_id', 'user'], name='dj_totp_tenant_user_idx'),
        ]

    def __str__(self) -> str:
        return f"TOTP credential for {self.user_id}"


class RecoveryCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='totp_recovery_codes',
    )
    code_hash = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'dj_recovery_codes'
        indexes = [
            models.Index(fields=['user'], name='dj_recovery_user_idx'),
        ]

    def __str__(self) -> str:
        return f"Recovery code for {self.user_id}"


# Legacy read-only models from old NestJS backend - kept for reference only
# These are NOT registered in admin and should NOT be used for new development
# Uncomment only if needed for data migration scripts
# from .legacy_models import LegacyUser  # noqa: E402,F401


class LegacyPasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    token_hash = models.CharField(max_length=128, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'dj_password_reset_tokens'
        indexes = [
            models.Index(fields=['user_id', 'used_at'], name='dj_pwdreset_user_used_idx'),
        ]

    def __str__(self) -> str:
        return f"PasswordResetToken(user={self.user_id})"
