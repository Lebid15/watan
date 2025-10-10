from django.urls import path
from .views import (
    profile, profile_with_currency,
    list_users, users_with_price_group, set_user_price_group,
    legacy_user_detail, legacy_user_set_password, legacy_user_set_overdraft,
    request_password_reset, reset_password,
)


urlpatterns = [
    path("profile", profile, name="users-profile"),
    path("profile-with-currency", profile_with_currency, name="users-profile-with-currency"),
    path("", list_users, name="users-list"),
    path("with-price-group", users_with_price_group, name="users-with-price-group"),
    path("password-reset/request", request_password_reset, name="users-password-reset-request"),
    path("password-reset/reset", reset_password, name="users-password-reset"),
    path("<str:id>/password", legacy_user_set_password, name="users-set-password"),
    path("<str:id>/password/", legacy_user_set_password, name="users-set-password-slash"),
    path("<str:id>/overdraft", legacy_user_set_overdraft, name="users-set-overdraft"),
    path("<str:id>/overdraft/", legacy_user_set_overdraft, name="users-set-overdraft-slash"),
    path("<str:id>/price-group", set_user_price_group, name="users-set-price-group"),
    path("<str:id>/price-group/", set_user_price_group, name="users-set-price-group-slash"),
    path("<str:id>", legacy_user_detail, name="users-detail"),
    path("<str:id>/", legacy_user_detail, name="users-detail-slash"),
]
