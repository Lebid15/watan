"""
Client API Token Management URLs
Matches NestJS routes: /api/tenant/client-api/users/*
"""
from django.urls import path
from .client_api_views import (
    UserApiTokenGenerateView,
    UserApiTokenRotateView,
    UserApiTokenRevokeView,
    UserApiTokenEnableView,
    UserApiSettingsView,
    WebhookSecretGenerateView,
    WebhookSecretRotateView,
    AdminUserApiTokenGenerateView,
)
from .client_api_orders_views import (
    ClientApiNewOrderView,
    ClientApiCheckOrderView,
)

urlpatterns = [
    # Current user endpoints (me) - with and without trailing slash
    path('users/me/generate', UserApiTokenGenerateView.as_view(), name='client-api-token-generate'),
    path('users/me/generate/', UserApiTokenGenerateView.as_view(), name='client-api-token-generate-slash'),
    path('users/me/rotate', UserApiTokenRotateView.as_view(), name='client-api-token-rotate'),
    path('users/me/rotate/', UserApiTokenRotateView.as_view(), name='client-api-token-rotate-slash'),
    path('users/me/revoke', UserApiTokenRevokeView.as_view(), name='client-api-token-revoke'),
    path('users/me/revoke/', UserApiTokenRevokeView.as_view(), name='client-api-token-revoke-slash'),
    path('users/me/enable', UserApiTokenEnableView.as_view(), name='client-api-token-enable'),
    path('users/me/enable/', UserApiTokenEnableView.as_view(), name='client-api-token-enable-slash'),
    path('users/me/settings', UserApiSettingsView.as_view(), name='client-api-settings'),
    path('users/me/settings/', UserApiSettingsView.as_view(), name='client-api-settings-slash'),
    path('users/me/webhook/secret/generate', WebhookSecretGenerateView.as_view(), name='webhook-secret-generate'),
    path('users/me/webhook/secret/generate/', WebhookSecretGenerateView.as_view(), name='webhook-secret-generate-slash'),
    path('users/me/webhook/secret/rotate', WebhookSecretRotateView.as_view(), name='webhook-secret-rotate'),
    path('users/me/webhook/secret/rotate/', WebhookSecretRotateView.as_view(), name='webhook-secret-rotate-slash'),
    
    # Admin endpoints (for managing other users)
    path('users/<int:user_id>/generate', AdminUserApiTokenGenerateView.as_view(), name='admin-client-api-token-generate'),
    path('users/<int:user_id>/generate/', AdminUserApiTokenGenerateView.as_view(), name='admin-client-api-token-generate-slash'),
]

# Client API Orders - these routes go under /client/api (not /api/tenant/client-api)
# We need to add them to main urls.py separately
client_api_orders_urlpatterns = [
    path('newOrder/<uuid:package_id>/params', ClientApiNewOrderView.as_view(), name='client-api-new-order'),
    path('check', ClientApiCheckOrderView.as_view(), name='client-api-check-order'),
]
