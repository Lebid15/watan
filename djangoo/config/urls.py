from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect
from rest_framework_simplejwt.views import TokenRefreshView
from apps.users.views import (
    LoginView,
    RegisterContextView,
    RegisterView,
    request_password_reset,
    reset_password,
)
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.core.views import health, public_latest_note, dev_maintenance_get, dev_maintenance_post
from apps.products.dev_views import SeedGlobalProductsView

API_PREFIX = settings.API_PREFIX.strip("/")

urlpatterns = [
    path("admin/", admin.site.urls),
    path(f"{API_PREFIX}/health", health, name="health"),
    path(f"{API_PREFIX}/dev/notes/public/latest", public_latest_note, name="dev_notes_public_latest"),
    # Maintenance parity endpoints for frontend middleware
    path(f"{API_PREFIX}/dev-maintenance", dev_maintenance_get, name='dev-maintenance'),
    path(f"{API_PREFIX}/dev-maintenance/toggle", dev_maintenance_post, name='dev-maintenance-toggle'),
    # Dev-only utilities
    path(f"{API_PREFIX}/dev/products/seed-global", SeedGlobalProductsView.as_view(), name='dev-seed-global-products'),
    path(f"{API_PREFIX}/schema", SpectacularAPIView.as_view(), name="schema"),
    path(f"{API_PREFIX}/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path(f"{API_PREFIX}/auth/login", LoginView.as_view(), name="token_obtain_pair"),
    path(f"{API_PREFIX}/auth/register", RegisterView.as_view(), name="auth_register"),
    path(f"{API_PREFIX}/auth/register-context", RegisterContextView.as_view(), name="auth_register_context"),
    path(f"{API_PREFIX}/auth/register-context/", RegisterContextView.as_view(), name="auth_register_context_slash"),
    path(f"{API_PREFIX}/auth/request-password-reset", request_password_reset, name="auth_request_password_reset"),
    path(f"{API_PREFIX}/auth/request-password-reset/", request_password_reset, name="auth_request_password_reset_slash"),
    path(f"{API_PREFIX}/auth/reset-password", reset_password, name="auth_reset_password"),
    path(f"{API_PREFIX}/auth/reset-password/", reset_password, name="auth_reset_password_slash"),
    path(f"{API_PREFIX}/auth/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path(f"{API_PREFIX}/auth/totp/", include("apps.users.totp_urls")),
    path(f"{API_PREFIX}/users/", include("apps.users.urls")),
    path(f"{API_PREFIX}/products/", include("apps.products.urls")),
    path(f"{API_PREFIX}/currencies/", include("apps.currencies.urls")),
    path(f"{API_PREFIX}/", include("apps.notifications.urls")),
    # static pages (public)
    path(f"{API_PREFIX}/", include("apps.pages.urls")),
    path(f"{API_PREFIX}/", include("apps.payments.urls")),
    # orders (user)
    path(f"{API_PREFIX}/", include("apps.orders.urls")),
    # payouts (user)
    path(f"{API_PREFIX}/", include("apps.payouts.urls")),
    # tenants (user current)
    path(f"{API_PREFIX}/", include("apps.tenants.urls")),
    # external public/api
    path(f"{API_PREFIX}/", include("apps.external_api.urls")),
    # admin orders
    path(f"{API_PREFIX}/admin/", include((__import__('apps.orders.urls', fromlist=['admin_urlpatterns']).admin_urlpatterns, 'orders'), namespace='admin-orders')),
    path(f"{API_PREFIX}/admin/", include((__import__('apps.payments.urls', fromlist=['admin_urlpatterns']).admin_urlpatterns, 'payments'), namespace='admin-payments')),
    path(f"{API_PREFIX}/admin/", include((__import__('apps.payouts.urls', fromlist=['admin_urlpatterns']).admin_urlpatterns, 'payouts'), namespace='admin-payouts')),
    path(f"{API_PREFIX}/admin/", include((__import__('apps.providers.urls', fromlist=['admin_urlpatterns']).admin_urlpatterns, 'providers'), namespace='admin-providers')),
    path(f"{API_PREFIX}/admin/", include((__import__('apps.reports.urls', fromlist=['admin_urlpatterns']).admin_urlpatterns, 'reports'), namespace='admin-reports')),
    path(f"{API_PREFIX}/admin/", include((__import__('apps.tenants.urls', fromlist=['admin_urlpatterns']).admin_urlpatterns, 'tenants'), namespace='admin-tenants')),
    path(f"{API_PREFIX}/admin/", include((__import__('apps.external_api.urls', fromlist=['admin_urlpatterns']).admin_urlpatterns, 'external_api'), namespace='admin-external-api')),
    path(f"{API_PREFIX}/admin/", include((__import__('apps.codes.urls', fromlist=['admin_urlpatterns']).admin_urlpatterns, 'codes'), namespace='admin-codes')),
    path(f"{API_PREFIX}/admin/", include((__import__('apps.products.urls', fromlist=['admin_urlpatterns']).admin_urlpatterns, 'products'), namespace='admin-products')),
    # admin settings/content pages
    path(f"{API_PREFIX}/admin/", include((__import__('apps.pages.urls', fromlist=['admin_urlpatterns']).admin_urlpatterns, 'pages'), namespace='admin-pages')),
]

# Developer convenience: when DEBUG, redirect root to API docs
if settings.DEBUG:
    urlpatterns.insert(0, path("", lambda request: redirect(f"/{API_PREFIX}/docs")))
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
