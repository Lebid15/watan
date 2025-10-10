import hashlib
import logging
import secrets
import uuid
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import LegacyPasswordResetToken

logger = logging.getLogger(__name__)

def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def _token_ttl() -> timedelta:
    minutes = getattr(settings, 'PASSWORD_RESET_TOKEN_TTL_MINUTES', 60)
    try:
        minutes = int(minutes)
    except (TypeError, ValueError):
        minutes = 60
    return timedelta(minutes=max(1, minutes))


def _normalize_user_id(user_id):
    if isinstance(user_id, uuid.UUID):
        return user_id
    try:
        return uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        try:
            int_value = int(user_id)
        except (TypeError, ValueError):
            raise ValueError('user_id must be UUID or integer-like') from None
        return uuid.UUID(int=int_value)


def create_password_reset_token(user_id, tenant_id=None) -> str:
    """Generate and persist a password reset token for the given legacy user."""
    # Remove expired tokens for this user to keep the table tidy
    now = timezone.now()
    normalized_user_id = _normalize_user_id(user_id)
    LegacyPasswordResetToken.objects.filter(user_id=normalized_user_id, used_at__isnull=True, expires_at__lt=now).delete()

    for _ in range(5):
        raw = secrets.token_urlsafe(32)
        token_hash = _hash_token(raw)
        if LegacyPasswordResetToken.objects.filter(token_hash=token_hash).exists():
            continue
        expires_at = now + _token_ttl()
        LegacyPasswordResetToken.objects.create(
            user_id=normalized_user_id,
            tenant_id=tenant_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        return raw

    raise RuntimeError('Unable to generate unique password reset token')


def build_password_reset_url(token: str, tenant_host: Optional[str] = None) -> str:
    base = getattr(settings, 'FRONTEND_BASE_URL', 'http://localhost:3000')
    host = (tenant_host or '').strip()
    if host:
        if '://' in host:
            base = host
        else:
            scheme = 'https'
            host_lower = host.lower()
            if host_lower.startswith('localhost') or host_lower.endswith('.localhost'):
                scheme = 'http'
            base = f"{scheme}://{host}"
    return f"{base.rstrip('/')}/password-reset?token={token}"


def send_password_reset_email(email: str, token: str, tenant_host: Optional[str] = None) -> None:
    if not email:
        logger.info('Password reset requested without email; skipping send')
        return
    url = build_password_reset_url(token, tenant_host)
    subject = 'رابط إعادة تعيين كلمة المرور'
    message = (
        'مرحباً،\n\n'
        'لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بك. '
        'يمكنك استخدام الرابط التالي لتعيين كلمة مرور جديدة (صالح لمدة محدودة):\n\n'
        f'{url}\n\n'
        'إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.'
    )
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
        logger.info('Password reset email queued for %s', email)
    except Exception as exc:
        logger.warning('Failed to send password reset email to %s: %s', email, exc, exc_info=True)


def consume_password_reset_token(raw_token: str) -> Optional[LegacyPasswordResetToken]:
    token_hash = _hash_token(raw_token)
    now = timezone.now()
    token = (
        LegacyPasswordResetToken.objects.select_for_update()
        .filter(token_hash=token_hash)
        .first()
    )
    if not token:
        return None
    if token.used_at is not None:
        return None
    if token.expires_at < now:
        return None
    return token