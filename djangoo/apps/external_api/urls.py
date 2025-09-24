from django.urls import path
from .views import (
    AdminTenantTokensView, AdminTenantTokenDetailView,
    ExternalOrdersCreateView,
)

urlpatterns = [
    # external routes
    path('external/orders', ExternalOrdersCreateView.as_view(), name='external-orders-create'),
]

admin_urlpatterns = [
    path('tokens', AdminTenantTokensView.as_view(), name='admin-tokens'),
    path('tokens/<uuid:token_id>', AdminTenantTokenDetailView.as_view(), name='admin-token-detail'),
]
