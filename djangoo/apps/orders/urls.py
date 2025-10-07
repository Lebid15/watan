from django.urls import path
from .views import (
    MyOrdersListView,
    AdminOrdersListView,
    MyOrderDetailsView,
    AdminOrderNotesView,
    AdminOrderDetailsView,
    AdminOrderSyncExternalView,
    AdminOrderRefreshStatusView,
)

urlpatterns = [
    path('orders/me', MyOrdersListView.as_view(), name='orders-me'),
    path('orders/me/', MyOrdersListView.as_view(), name='orders-me-slash'),
    path('orders/<uuid:id>', MyOrderDetailsView.as_view(), name='orders-details'),
    path('orders/<uuid:id>/', MyOrderDetailsView.as_view(), name='orders-details-slash'),
]

# Admin routes are included at root include with prefix 'admin/' in config urls
admin_urlpatterns = [
    # Accept both with and without trailing slash for robustness with frontend normalization
    path('orders', AdminOrdersListView.as_view(), name='admin-orders-list'),
    path('orders/', AdminOrdersListView.as_view(), name='admin-orders-list-slash'),
    # Bulk actions
    path('orders/bulk/approve', __import__('apps.orders.views', fromlist=['AdminOrdersBulkApproveView']).AdminOrdersBulkApproveView.as_view(), name='admin-orders-bulk-approve'),
    path('orders/bulk/approve/', __import__('apps.orders.views', fromlist=['AdminOrdersBulkApproveView']).AdminOrdersBulkApproveView.as_view(), name='admin-orders-bulk-approve-slash'),
    path('orders/bulk/reject', __import__('apps.orders.views', fromlist=['AdminOrdersBulkRejectView']).AdminOrdersBulkRejectView.as_view(), name='admin-orders-bulk-reject'),
    path('orders/bulk/reject/', __import__('apps.orders.views', fromlist=['AdminOrdersBulkRejectView']).AdminOrdersBulkRejectView.as_view(), name='admin-orders-bulk-reject-slash'),
    path('orders/bulk/manual', __import__('apps.orders.views', fromlist=['AdminOrdersBulkManualView']).AdminOrdersBulkManualView.as_view(), name='admin-orders-bulk-manual'),
    path('orders/bulk/manual/', __import__('apps.orders.views', fromlist=['AdminOrdersBulkManualView']).AdminOrdersBulkManualView.as_view(), name='admin-orders-bulk-manual-slash'),
    path('orders/bulk/dispatch', __import__('apps.orders.views', fromlist=['AdminOrdersBulkDispatchView']).AdminOrdersBulkDispatchView.as_view(), name='admin-orders-bulk-dispatch'),
    path('orders/bulk/dispatch/', __import__('apps.orders.views', fromlist=['AdminOrdersBulkDispatchView']).AdminOrdersBulkDispatchView.as_view(), name='admin-orders-bulk-dispatch-slash'),
    path('pending-orders-count', __import__('apps.orders.views', fromlist=['AdminPendingOrdersCountView']).AdminPendingOrdersCountView.as_view(), name='admin-orders-pending-count'),
    path('pending-orders-count/', __import__('apps.orders.views', fromlist=['AdminPendingOrdersCountView']).AdminPendingOrdersCountView.as_view(), name='admin-orders-pending-count-slash'),
    path('orders/<uuid:id>', AdminOrderDetailsView.as_view(), name='admin-orders-by-id'),
    path('orders/<uuid:id>/', AdminOrderDetailsView.as_view(), name='admin-orders-by-id-slash'),
    path('orders/<uuid:id>/notes', AdminOrderNotesView.as_view(), name='admin-orders-notes'),
    path('orders/<uuid:id>/notes/', AdminOrderNotesView.as_view(), name='admin-orders-notes-slash'),
    path('orders/<uuid:id>/sync-external', AdminOrderSyncExternalView.as_view(), name='admin-order-sync-external'),
    path('orders/<uuid:id>/sync-external/', AdminOrderSyncExternalView.as_view(), name='admin-order-sync-external-slash'),
    path('orders/<uuid:id>/refresh-external', AdminOrderRefreshStatusView.as_view(), name='admin-order-refresh-external'),
    path('orders/<uuid:id>/refresh-external/', AdminOrderRefreshStatusView.as_view(), name='admin-order-refresh-external-slash'),
]
