import base64
import hashlib
import io
import logging
import os
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import List, Optional

import pyotp
import qrcode
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import Throttled, ValidationError

from .models import RecoveryCode, TotpCredential


@dataclass
class TotpSetupResult:
    secret: str
    qr_code: str
    backup_codes: List[str]
    credential_id: str


class TotpService:
    """Utility service implementing core TOTP flows for the Django API."""

    def __init__(self) -> None:
        self.logger = logging.getLogger('apps.users.totp')
        key_hex = os.getenv('TOTP_SECRET_ENC_KEY')
        if key_hex:
            try:
                key_bytes = bytes.fromhex(key_hex)
            except ValueError as exc:
                raise RuntimeError('TOTP_SECRET_ENC_KEY must be a hex string') from exc
            if len(key_bytes) != 32:
                raise RuntimeError('TOTP_SECRET_ENC_KEY must be 32 bytes (64 hex characters)')
            self._key = key_bytes
        else:
            self._key = os.urandom(32)
            self.logger.warning('TOTP_SECRET_ENC_KEY not set; using ephemeral key (secrets will reset on restart)')
        self._issuer = os.getenv('TOTP_ISSUER', 'watan.app')
        self._backend = default_backend()

    # Encryption helpers -------------------------------------------------
    def _encrypt(self, value: str) -> str:
        data = value.encode('utf-8')
        padder = padding.PKCS7(algorithms.AES.block_size).padder()
        padded = padder.update(data) + padder.finalize()
        iv = os.urandom(16)
        cipher = Cipher(algorithms.AES(self._key), modes.CBC(iv), backend=self._backend)
        encryptor = cipher.encryptor()
        encrypted = encryptor.update(padded) + encryptor.finalize()
        return f"{iv.hex()}:{encrypted.hex()}"

    def _decrypt(self, value: str) -> str:
        try:
            iv_hex, encrypted_hex = value.split(':', 1)
        except ValueError as exc:
            raise RuntimeError('Malformed encrypted secret') from exc
        iv = bytes.fromhex(iv_hex)
        encrypted = bytes.fromhex(encrypted_hex)
        cipher = Cipher(algorithms.AES(self._key), modes.CBC(iv), backend=self._backend)
        decryptor = cipher.decryptor()
        padded = decryptor.update(encrypted) + decryptor.finalize()
        unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
        data = unpadder.update(padded) + unpadder.finalize()
        return data.decode('utf-8')

    # Recovery codes -----------------------------------------------------
    def _generate_recovery_codes(self, user) -> List[str]:
        codes: List[str] = []
        with transaction.atomic():
            RecoveryCode.objects.filter(user=user).delete()
            for _ in range(8):
                code = secrets.token_hex(4).upper()
                code_hash = hashlib.sha256(code.encode('utf-8')).hexdigest()
                RecoveryCode.objects.create(user=user, code_hash=code_hash)
                codes.append(code)
        return codes

    def _verify_recovery_code(self, user, candidate: str) -> bool:
        if not candidate:
            return False
        hashed = hashlib.sha256(candidate.upper().encode('utf-8')).hexdigest()
        with transaction.atomic():
            code = (
                RecoveryCode.objects.select_for_update()
                .filter(user=user, code_hash=hashed, used_at__isnull=True)
                .first()
            )
            if not code:
                return False
            code.used_at = timezone.now()
            code.save(update_fields=['used_at'])
            return True

    # User helpers -------------------------------------------------------
    def _reset_failed_attempts(self, user) -> None:
        user.totp_failed_attempts = 0
        user.totp_locked_until = None
        user.save(update_fields=['totp_failed_attempts', 'totp_locked_until'])

    def _register_failed_attempt(self, user) -> None:
        user.totp_failed_attempts = (user.totp_failed_attempts or 0) + 1
        updates = ['totp_failed_attempts']
        if user.totp_failed_attempts >= 5:
            user.totp_locked_until = timezone.now() + timedelta(minutes=15)
            updates.append('totp_locked_until')
        user.save(update_fields=updates)

    # Public API ---------------------------------------------------------
    def generate_secret(self, user, tenant_id: Optional[str] = None, label: Optional[str] = None) -> TotpSetupResult:
        secret = pyotp.random_base32(32)
        credential = TotpCredential.objects.create(
            user=user,
            tenant_id=tenant_id,
            encrypted_secret=self._encrypt(secret),
            label=label or 'Authenticator',
            is_active=False,
        )
        codes = self._generate_recovery_codes(user)
        otpauth_uri = pyotp.TOTP(secret).provisioning_uri(
            name=(user.email or user.username or str(user.pk)),
            issuer_name=self._issuer,
        )
        qr = qrcode.QRCode(box_size=6, border=2)
        qr.add_data(otpauth_uri)
        qr.make(fit=True)
        image = qr.make_image(fill_color='black', back_color='white')
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        qr_data_url = 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')
        return TotpSetupResult(
            secret=secret,
            qr_code=qr_data_url,
            backup_codes=codes,
            credential_id=str(credential.id),
        )

    def verify_and_activate(self, user, token: str, credential_id: str) -> bool:
        credential = TotpCredential.objects.filter(id=credential_id, user=user, is_active=False).first()
        if not credential:
            raise ValidationError('Invalid credential')
        secret = self._decrypt(credential.encrypted_secret)
        totp = pyotp.TOTP(secret)
        verified = totp.verify(token, valid_window=1)
        if verified:
            credential.is_active = True
            credential.save(update_fields=['is_active'])
            user.force_totp_enroll = False
            user.save(update_fields=['force_totp_enroll'])
            self._reset_failed_attempts(user)
        return verified

    def verify_token(self, user, token: str) -> bool:
        if not token:
            raise ValidationError('Token required')
        if user.totp_locked_until and user.totp_locked_until > timezone.now():
            raise Throttled(detail='TOTP temporarily locked')
        if self._verify_recovery_code(user, token):
            self._reset_failed_attempts(user)
            return True
        credentials = TotpCredential.objects.filter(user=user, is_active=True)
        for credential in credentials:
            secret = self._decrypt(credential.encrypted_secret)
            totp = pyotp.TOTP(secret)
            if totp.verify(token, valid_window=1):
                credential.last_used_at = timezone.now()
                credential.usage_count = (credential.usage_count or 0) + 1
                credential.save(update_fields=['last_used_at', 'usage_count'])
                self._reset_failed_attempts(user)
                return True
        self._register_failed_attempt(user)
        return False

    def has_totp_enabled(self, user) -> bool:
        return TotpCredential.objects.filter(user=user, is_active=True).exists()

    def disable_totp(self, user) -> None:
        with transaction.atomic():
            TotpCredential.objects.filter(user=user).update(is_active=False)
            RecoveryCode.objects.filter(user=user).delete()
            user.force_totp_enroll = False
            user.totp_failed_attempts = 0
            user.totp_locked_until = None
            user.save(update_fields=['force_totp_enroll', 'totp_failed_attempts', 'totp_locked_until'])

    def regenerate_recovery_codes(self, user) -> List[str]:
        if not self.has_totp_enabled(user):
            raise ValidationError('TOTP not enabled')
        return self._generate_recovery_codes(user)

    def reset_two_factor(self, target_user, actor) -> None:
        with transaction.atomic():
            TotpCredential.objects.filter(user=target_user).update(is_active=False)
            RecoveryCode.objects.filter(user=target_user).delete()
            target_user.force_totp_enroll = True
            target_user.totp_failed_attempts = 0
            target_user.totp_locked_until = None
            target_user.save(update_fields=['force_totp_enroll', 'totp_failed_attempts', 'totp_locked_until'])
        self.logger.info('TOTP reset by %s for user %s', actor.pk, target_user.pk)


_totp_service: Optional[TotpService] = None


def get_totp_service() -> TotpService:
    global _totp_service
    if _totp_service is None:
        _totp_service = TotpService()
    return _totp_service
