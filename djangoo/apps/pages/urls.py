from django.urls import path
from .views import PublicAboutView, PublicInfoesView, AdminAboutView, AdminInfoesView, PublicBannerView, AdminBannerView

urlpatterns = [
    path('pages/about', PublicAboutView.as_view(), name='public-about'),
    path('pages/about/', PublicAboutView.as_view(), name='public-about-slash'),
    path('pages/infoes', PublicInfoesView.as_view(), name='public-infoes'),
    path('pages/infoes/', PublicInfoesView.as_view(), name='public-infoes-slash'),
    path('pages/banner', PublicBannerView.as_view(), name='public-banner'),
    path('pages/banner/', PublicBannerView.as_view(), name='public-banner-slash'),
]

admin_urlpatterns = [
    path('settings/about', AdminAboutView.as_view(), name='admin-settings-about'),
    path('settings/about/', AdminAboutView.as_view(), name='admin-settings-about-slash'),
    path('settings/infoes', AdminInfoesView.as_view(), name='admin-settings-infoes'),
    path('settings/infoes/', AdminInfoesView.as_view(), name='admin-settings-infoes-slash'),
    path('settings/banner', AdminBannerView.as_view(), name='admin-settings-banner'),
    path('settings/banner/', AdminBannerView.as_view(), name='admin-settings-banner-slash'),
]
