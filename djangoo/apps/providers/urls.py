from django.urls import path
from .views import (
    AdminProvidersListView,
    AdminProviderDetailsView,
    AdminPackageMappingsListView,
    AdminIntegrationsListCreateView,
    AdminIntegrationDetailView,
    AdminRoutingGetUpsertView,
    AdminRoutingAllView,
    AdminRoutingSetProviderView,
    AdminRoutingSetTypeView,
    AdminRoutingSetCodeGroupView,
    AdminPackageCostsListUpsertDeleteView,
    AdminIntegrationBalanceView,
    AdminIntegrationImportCatalogView,
    AdminProvidersCoverageView,
    AdminProvidersCoverageCSVView,
)

admin_urlpatterns = [
    path('providers', AdminProvidersListView.as_view(), name='admin-providers-list'),
    path('providers/<uuid:id>', AdminProviderDetailsView.as_view(), name='admin-providers-details'),
    path('providers/package-mappings', AdminPackageMappingsListView.as_view(), name='admin-provider-mappings'),
    # Integrations CRUD
    path('integrations', AdminIntegrationsListCreateView.as_view(), name='admin-integrations-list-create'),
    path('integrations/<uuid:id>', AdminIntegrationDetailView.as_view(), name='admin-integrations-detail'),
    # Routing & Costs
    path('routing/packages/<uuid:package_id>', AdminRoutingGetUpsertView.as_view(), name='admin-routing-package'),
    path('integrations/routing/all', AdminRoutingAllView.as_view(), name='admin-routing-all'),
    path('integrations/routing/set', AdminRoutingSetProviderView.as_view(), name='admin-routing-set'),
    path('integrations/routing/set-type', AdminRoutingSetTypeView.as_view(), name='admin-routing-set-type'),
    path('integrations/routing/set-code-group', AdminRoutingSetCodeGroupView.as_view(), name='admin-routing-set-code-group'),
    path('package-costs', AdminPackageCostsListUpsertDeleteView.as_view(), name='admin-package-costs'),
    path('integrations/provider-cost', __import__('apps.providers.views', fromlist=['AdminProviderCostView']).AdminProviderCostView.as_view(), name='admin-provider-cost'),
    # Ops
    path('integrations/<uuid:id>/refresh-balance', AdminIntegrationBalanceView.as_view(), name='admin-integrations-refresh-balance'),
    path('integrations/<uuid:id>/import-catalog', AdminIntegrationImportCatalogView.as_view(), name='admin-integrations-import-catalog'),
    path('providers/coverage', AdminProvidersCoverageView.as_view(), name='admin-providers-coverage'),
    path('providers/coverage.csv', AdminProvidersCoverageCSVView.as_view(), name='admin-providers-coverage-csv'),
]
