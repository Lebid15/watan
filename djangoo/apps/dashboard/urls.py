from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DashboardAnnouncementViewSet, DashboardAnnouncementAdminViewSet

router = DefaultRouter()
router.register(r'announcements', DashboardAnnouncementViewSet, basename='announcement')
router.register(r'admin/announcements', DashboardAnnouncementAdminViewSet, basename='announcement-admin')

app_name = 'dashboard'

urlpatterns = [
    path('', include(router.urls)),
]
