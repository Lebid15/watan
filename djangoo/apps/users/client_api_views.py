"""
Client API Token Management Views
Matching NestJS backend: src/client-api/client-api.admin.controller.ts
"""
import logging
import secrets
from datetime import datetime

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied

from .models import User
from .permissions import RequireAdminRole

logger = logging.getLogger(__name__)


def generate_hex_token(length: int = 40) -> str:
    """Generate a random hex token of specified length"""
    return secrets.token_hex(length // 2)[:length]


class UserApiTokenGenerateView(APIView):
    """
    POST /api-dj/tenant/client-api/users/me/generate
    Generate a new API token for current user
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        # Generate new token
        token = generate_hex_token(40)
        user.api_token = token
        user.api_token_revoked = False
        user.api_enabled = True
        user.save(update_fields=['api_token', 'api_token_revoked', 'api_enabled'])
        
        logger.info(f'✅ Generated API token for user={user.username}, tenant_id={user.tenant_id}')
        
        return Response({
            'token': token,
            'message': 'تم إنشاء التوكن بنجاح'
        }, status=status.HTTP_201_CREATED)


class UserApiTokenRotateView(APIView):
    """
    POST /api-dj/tenant/client-api/users/me/rotate
    Rotate (regenerate) API token for current user
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        old_token = user.api_token
        
        # Generate new token
        token = generate_hex_token(40)
        user.api_token = token
        user.api_token_revoked = False
        user.api_enabled = True
        user.save(update_fields=['api_token', 'api_token_revoked', 'api_enabled'])
        
        logger.info(f'✅ Rotated API token for user={user.username}, tenant_id={user.tenant_id}')
        
        return Response({
            'token': token,
            'message': 'تم تجديد التوكن بنجاح'
        }, status=status.HTTP_200_OK)


class UserApiTokenRevokeView(APIView):
    """
    POST /api-dj/tenant/client-api/users/me/revoke
    Revoke API token for current user
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        user.api_token_revoked = True
        user.save(update_fields=['api_token_revoked'])
        
        logger.info(f'✅ Revoked API token for user={user.username}, tenant_id={user.tenant_id}')
        
        return Response({
            'revoked': True,
            'message': 'تم إبطال التوكن بنجاح'
        }, status=status.HTTP_200_OK)


class UserApiTokenEnableView(APIView):
    """
    POST /api-dj/tenant/client-api/users/me/enable
    Enable API access for current user
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        user.api_enabled = True
        user.save(update_fields=['api_enabled'])
        
        logger.info(f'✅ Enabled API for user={user.username}, tenant_id={user.tenant_id}')
        
        return Response({
            'enabled': True,
            'message': 'تم تفعيل الوصول للـ API'
        }, status=status.HTTP_200_OK)


class UserApiSettingsView(APIView):
    """
    GET/PATCH /api-dj/tenant/client-api/users/me/settings
    Get or update API settings for current user
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        return Response({
            'allowAll': user.api_allow_all_ips if user.api_allow_all_ips is not None else True,
            'allowIps': user.api_allow_ips or [],
            'webhookUrl': user.api_webhook_url,
            'enabled': user.api_enabled or False,
            'revoked': user.api_token_revoked or False,
            'lastUsedAt': user.api_last_used_at.isoformat() if user.api_last_used_at else None,
            'rateLimitPerMin': user.api_rate_limit_per_min,
            'webhook': {
                'enabled': user.api_webhook_enabled or False,
                'url': user.api_webhook_url,
                'sigVersion': user.api_webhook_sig_version or 'v1',
                'hasSecret': bool(user.api_webhook_secret),
                'lastRotatedAt': user.api_webhook_last_rotated_at.isoformat() if user.api_webhook_last_rotated_at else None,
            }
        })

    def patch(self, request):
        user = request.user
        data = request.data or {}
        
        update_fields = []
        
        # Update allowAll
        if 'allowAll' in data:
            user.api_allow_all_ips = bool(data['allowAll'])
            update_fields.append('api_allow_all_ips')
        
        # Update allowIps
        if 'allowIps' in data:
            ips = data['allowIps']
            if isinstance(ips, list):
                # Filter and validate IPs
                user.api_allow_ips = [ip for ip in ips if isinstance(ip, str) and len(ip) <= 64][:200]
                update_fields.append('api_allow_ips')
        
        # Update webhookUrl
        if 'webhookUrl' in data:
            user.api_webhook_url = data['webhookUrl'] or None
            update_fields.append('api_webhook_url')
        
        # Update enabled
        if 'enabled' in data:
            user.api_enabled = bool(data['enabled'])
            update_fields.append('api_enabled')
        
        # Update rateLimitPerMin
        if 'rateLimitPerMin' in data:
            rate_limit = data['rateLimitPerMin']
            if rate_limit is None:
                user.api_rate_limit_per_min = None
            elif isinstance(rate_limit, (int, float)) and 1 <= rate_limit <= 10000:
                user.api_rate_limit_per_min = int(rate_limit)
            update_fields.append('api_rate_limit_per_min')
        
        if update_fields:
            user.save(update_fields=update_fields)
            logger.info(f'✅ Updated API settings for user={user.username}, fields={update_fields}')
        
        return Response({
            'updated': True,
            'message': 'تم تحديث الإعدادات بنجاح'
        })


class WebhookSecretGenerateView(APIView):
    """
    POST /api-dj/tenant/client-api/users/me/webhook/secret/generate
    Generate webhook secret for current user
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        if user.api_webhook_secret:
            return Response({
                'error': 'ALREADY_EXISTS',
                'message': 'السر موجود بالفعل، استخدم /rotate لتجديده'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate webhook secret (32 hex chars)
        secret = generate_hex_token(64)
        user.api_webhook_secret = secret
        user.api_webhook_enabled = False  # Must enable explicitly
        user.api_webhook_sig_version = 'v1'
        user.api_webhook_last_rotated_at = timezone.now()
        user.save(update_fields=[
            'api_webhook_secret',
            'api_webhook_enabled',
            'api_webhook_sig_version',
            'api_webhook_last_rotated_at'
        ])
        
        logger.info(f'✅ Generated webhook secret for user={user.username}')
        
        return Response({
            'secret': secret,
            'version': user.api_webhook_sig_version,
            'message': 'تم إنشاء السر بنجاح'
        }, status=status.HTTP_201_CREATED)


class WebhookSecretRotateView(APIView):
    """
    POST /api-dj/tenant/client-api/users/me/webhook/secret/rotate
    Rotate webhook secret for current user
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        if not user.api_webhook_secret:
            return Response({
                'error': 'NO_SECRET',
                'message': 'لا يوجد سر، استخدم /generate أولاً'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate new webhook secret
        secret = generate_hex_token(64)
        user.api_webhook_secret = secret
        user.api_webhook_last_rotated_at = timezone.now()
        user.save(update_fields=['api_webhook_secret', 'api_webhook_last_rotated_at'])
        
        logger.info(f'✅ Rotated webhook secret for user={user.username}')
        
        return Response({
            'secret': secret,
            'version': user.api_webhook_sig_version or 'v1',
            'message': 'تم تجديد السر بنجاح'
        }, status=status.HTTP_200_OK)


# Admin views for managing other users' tokens (tenant_owner only)
class AdminUserApiTokenGenerateView(APIView):
    """
    POST /api-dj/tenant/client-api/users/:id/generate
    Generate API token for specific user (admin only)
    """
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def post(self, request, user_id: int):
        try:
            user = User.objects.get(id=user_id, tenant_id=request.user.tenant_id)
        except User.DoesNotExist:
            raise NotFound('المستخدم غير موجود')
        
        token = generate_hex_token(40)
        user.api_token = token
        user.api_token_revoked = False
        user.api_enabled = True
        user.save(update_fields=['api_token', 'api_token_revoked', 'api_enabled'])
        
        logger.info(f'✅ Admin generated API token for user={user.username}')
        
        return Response({
            'token': token,
            'message': 'تم إنشاء التوكن بنجاح'
        }, status=status.HTTP_201_CREATED)
