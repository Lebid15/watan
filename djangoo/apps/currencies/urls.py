from django.urls import path
from .views import (
    CurrenciesListCreateView,
    CurrenciesBulkUpdateView,
    CurrencyDetailView,
    CurrenciesSeedDefaultsView,
)

urlpatterns = [
    path('', CurrenciesListCreateView.as_view(), name='currencies-list-create'),
    path('bulk-update', CurrenciesBulkUpdateView.as_view(), name='currencies-bulk-update'),
    path('<uuid:id>', CurrencyDetailView.as_view(), name='currencies-detail'),
    path('seed-defaults', CurrenciesSeedDefaultsView.as_view(), name='currencies-seed-defaults'),
]
