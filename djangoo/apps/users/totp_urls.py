from django.urls import path

from . import totp_views

urlpatterns = [
    path('setup/', totp_views.TotpSetupView.as_view(), name='auth-totp-setup'),
    path('verify-setup/', totp_views.TotpVerifySetupView.as_view(), name='auth-totp-verify-setup'),
    path('verify/', totp_views.TotpVerifyView.as_view(), name='auth-totp-verify'),
    path('status/', totp_views.TotpStatusView.as_view(), name='auth-totp-status'),
    path('disable/', totp_views.TotpDisableView.as_view(), name='auth-totp-disable'),
    path('recovery-codes/regenerate/', totp_views.TotpRegenerateCodesView.as_view(), name='auth-totp-regenerate'),
    path('reset/<uuid:user_id>/', totp_views.TotpResetView.as_view(), name='auth-totp-reset'),
]
