from django.urls import path
from .views import (
    PaymentMethodsListView,
    AdminPaymentMethodsListCreateView,
    AdminPaymentMethodByIdView,
    MyDepositsListView,
    AdminDepositsListView,
    AdminDepositTopupView,
    AdminDepositDetailsView,
    AdminDepositNotesView,
    AdminUploadView,
)

urlpatterns = [
    path('payment-methods', PaymentMethodsListView.as_view(), name='payment-methods'),
    path('payment-methods/', PaymentMethodsListView.as_view(), name='payment-methods-slash'),
    path('payment-methods/active', PaymentMethodsListView.as_view(), name='payment-methods-active'),
    path('payment-methods/active/', PaymentMethodsListView.as_view(), name='payment-methods-active-slash'),
    path('deposits', MyDepositsListView.as_view(), name='deposits'),
    path('deposits/', MyDepositsListView.as_view(), name='deposits-slash'),
    path('deposits/me', MyDepositsListView.as_view(), name='deposits-me'),
    path('deposits/me/', MyDepositsListView.as_view(), name='deposits-me-slash'),
    path('deposits/mine', MyDepositsListView.as_view(), name='deposits-mine'),
    path('deposits/mine/', MyDepositsListView.as_view(), name='deposits-mine-slash'),
]

# Admin routes
admin_urlpatterns = [
    # Admin payment methods
    path('payment-methods', AdminPaymentMethodsListCreateView.as_view(), name='admin-payment-methods'),
    path('payment-methods/', AdminPaymentMethodsListCreateView.as_view(), name='admin-payment-methods-slash'),
    path('payment-methods/<uuid:id>', AdminPaymentMethodByIdView.as_view(), name='admin-payment-methods-by-id'),
    path('payment-methods/<uuid:id>/', AdminPaymentMethodByIdView.as_view(), name='admin-payment-methods-by-id-slash'),
    # Admin upload (shared)
    path('upload', AdminUploadView.as_view(), name='admin-upload'),
    path('upload/', AdminUploadView.as_view(), name='admin-upload-slash'),
    path('pending-deposits-count', __import__('apps.payments.views', fromlist=['AdminPendingDepositsCountView']).AdminPendingDepositsCountView.as_view(), name='admin-deposits-pending-count'),
    path('pending-deposits-count/', __import__('apps.payments.views', fromlist=['AdminPendingDepositsCountView']).AdminPendingDepositsCountView.as_view(), name='admin-deposits-pending-count-slash'),
    path('deposits', AdminDepositsListView.as_view(), name='admin-deposits-list'),
    path('deposits/', AdminDepositsListView.as_view(), name='admin-deposits-list-slash'),
    path('deposits/topup', AdminDepositTopupView.as_view(), name='admin-deposits-topup'),
    path('deposits/topup/', AdminDepositTopupView.as_view(), name='admin-deposits-topup-slash'),
    path('deposits/<uuid:id>', AdminDepositDetailsView.as_view(), name='admin-deposits-details'),
    path('deposits/<uuid:id>/', AdminDepositDetailsView.as_view(), name='admin-deposits-details-slash'),
    path('deposits/<uuid:id>/status', __import__('apps.payments.views', fromlist=['AdminDepositStatusView']).AdminDepositStatusView.as_view(), name='admin-deposits-status'),
    path('deposits/<uuid:id>/status/', __import__('apps.payments.views', fromlist=['AdminDepositStatusView']).AdminDepositStatusView.as_view(), name='admin-deposits-status-slash'),
    path('deposits/<uuid:id>/notes', AdminDepositNotesView.as_view(), name='admin-deposits-notes'),
    path('deposits/<uuid:id>/notes/', AdminDepositNotesView.as_view(), name='admin-deposits-notes-slash'),
]
