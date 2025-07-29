from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import CustomUser

class APITokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = request.headers.get('X-API-TOKEN')
        if not token:
            return None

        try:
            user = CustomUser.objects.get(api_token=token)
        except CustomUser.DoesNotExist:
            raise AuthenticationFailed('Invalid API token')

        return (user, None)