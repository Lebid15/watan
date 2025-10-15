from typing import Optional, Tuple
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
import jwt


class ApiTokenAuthentication(BaseAuthentication):
    keyword = 'Api-Token'

    def authenticate(self, request) -> Optional[Tuple[object, None]]:
        # Support both X-API-Token and api-token headers
        token = request.META.get('HTTP_X_API_TOKEN') or request.META.get('HTTP_API_TOKEN') or request.META.get('HTTP_X_API_TOKEN'.upper())
        if not token:
            return None
        User = get_user_model()
        try:
            user = User.objects.get(api_token=token)
        except User.DoesNotExist:
            raise AuthenticationFailed('Invalid API token')
        
        # Check if user is active
        if getattr(user, 'status', 'active') != 'active':
            raise AuthenticationFailed('User inactive or deleted')
        
        # Check if API access is enabled
        if not getattr(user, 'api_enabled', False):
            raise AuthenticationFailed('API access is not enabled for this user')
        
        # Check if token is revoked
        if getattr(user, 'api_token_revoked', False):
            raise AuthenticationFailed('API token has been revoked')
        
        # Update last used timestamp
        from django.utils import timezone
        user.api_last_used_at = timezone.now()
        user.save(update_fields=['api_last_used_at'])
        
        return (user, None)


class LegacyJWTAuthentication(BaseAuthentication):
    keyword = 'Bearer'

    def authenticate(self, request) -> Optional[Tuple[object, None]]:
        auth = get_authorization_header(request).split()
        if not auth or auth[0].lower() != b'bearer':
            return None
        if len(auth) == 1:
            raise AuthenticationFailed('Invalid token header')
        token = auth[1].decode('utf-8')
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expired')
        except jwt.InvalidTokenError:
            return None

        if not payload.get('legacy'):
            return None

        user_id = payload.get('sub') or payload.get('user_id')
        if not user_id:
            raise AuthenticationFailed('Invalid token payload')

        from .legacy_models import LegacyUser

        try:
            legacy_user = LegacyUser.objects.get(id=user_id)
        except LegacyUser.DoesNotExist:
            raise AuthenticationFailed('User not found')

        setattr(legacy_user, 'is_authenticated', True)
        request.legacy_token_payload = payload
        return (legacy_user, None)
