from django.urls import path
from .views import (
    ProductsListView,
    ProductDetailView,
    PriceGroupsListCreateView,
    PriceGroupDetailView,
    UsersPriceGroupsView,
)

urlpatterns = [
    path('', ProductsListView.as_view(), name='products-list'),
    path('<uuid:id>', ProductDetailView.as_view(), name='products-detail'),
    # price groups
    path('price-groups', PriceGroupsListCreateView.as_view(), name='price-groups-list-create'),
    path('price-groups/<uuid:id>', PriceGroupDetailView.as_view(), name='price-groups-detail'),
    path('price-groups/users', UsersPriceGroupsView.as_view(), name='price-groups-users'),
]
