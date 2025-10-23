"""
Routing System URLs
روابط نظام التوجيه
"""

from django.urls import path
from .routing_health_views import (
    RoutingHealthCheckView,
    RoutingHealthSummaryView,
    RoutingHealthClearCacheView
)

urlpatterns = [
    # فحص صحة التوجيه
    path('health/', RoutingHealthCheckView.as_view(), name='routing_health_check'),
    path('health/summary/', RoutingHealthSummaryView.as_view(), name='routing_health_summary'),
    path('health/clear-cache/', RoutingHealthClearCacheView.as_view(), name='routing_health_clear_cache'),
]

