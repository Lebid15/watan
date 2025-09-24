from django.urls import path
from .views import (
    AdminCodeGroupsListCreateView,
    AdminCodeGroupToggleView,
    AdminCodeGroupItemsListView,
    AdminCodeGroupItemsBulkAddView,
    AdminCodeItemDeleteView,
)

admin_urlpatterns = [
    path('codes/groups', AdminCodeGroupsListCreateView.as_view(), name='admin-codes-groups'),
    path('codes/groups/<uuid:id>/toggle', AdminCodeGroupToggleView.as_view(), name='admin-codes-groups-toggle'),
    path('codes/groups/<uuid:id>/items', AdminCodeGroupItemsListView.as_view(), name='admin-codes-groups-items'),
    path('codes/groups/<uuid:id>/items/bulk', AdminCodeGroupItemsBulkAddView.as_view(), name='admin-codes-groups-items-bulk'),
    path('codes/items/<uuid:id>', AdminCodeItemDeleteView.as_view(), name='admin-codes-item-delete'),
]
