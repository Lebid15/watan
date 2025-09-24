from typing import Optional, Tuple
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


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
        if getattr(user, 'status', 'active') != 'active':
            raise AuthenticationFailed('User inactive or deleted')
        return (user, None)
