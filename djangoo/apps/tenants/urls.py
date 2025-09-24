from django.urls import path
from .views import (
    AdminTenantsListCreateView, AdminTenantDetailView,
    AdminTenantDomainsView, AdminTenantDomainDetailView,
    CurrentTenantView,
)

urlpatterns = [
    path('tenants/current', CurrentTenantView.as_view(), name='tenants-current'),
]

admin_urlpatterns = [
    path('tenants', AdminTenantsListCreateView.as_view(), name='admin-tenants'),
    path('tenants/<uuid:tenant_id>', AdminTenantDetailView.as_view(), name='admin-tenant-detail'),
    path('tenants/<uuid:tenant_id>/domains', AdminTenantDomainsView.as_view(), name='admin-tenant-domains'),
    path('tenants/<uuid:tenant_id>/domains/<uuid:domain_id>', AdminTenantDomainDetailView.as_view(), name='admin-tenant-domain-detail'),
]
