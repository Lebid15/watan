from django.urls import path
from .views import (
    MyPayoutsListView,
    AdminPayoutsListView,
    AdminPayoutDetailsView,
    AdminPayoutNotesView,
)

urlpatterns = [
    path('payouts/me', MyPayoutsListView.as_view(), name='payouts-me'),
]

admin_urlpatterns = [
    path('payouts', AdminPayoutsListView.as_view(), name='admin-payouts-list'),
    path('payouts/<uuid:id>', AdminPayoutDetailsView.as_view(), name='admin-payouts-details'),
    path('payouts/<uuid:id>/notes', AdminPayoutNotesView.as_view(), name='admin-payouts-notes'),
]
