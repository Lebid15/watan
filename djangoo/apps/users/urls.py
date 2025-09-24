from django.urls import path
from .views import (
    profile, profile_with_currency,
    list_users, users_with_price_group, set_user_price_group,
)


urlpatterns = [
    path("profile", profile, name="users-profile"),
    path("profile-with-currency", profile_with_currency, name="users-profile-with-currency"),
    path("", list_users, name="users-list"),
    path("with-price-group", users_with_price_group, name="users-with-price-group"),
    path("<uuid:id>/price-group", set_user_price_group, name="users-set-price-group"),
]
