from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Wallet", {"fields": ("balance", "currency", "overdraft")}),
        ("API", {"fields": ("api_token", "status", "role")}),
    )
    list_display = ("id", "username", "email", "role", "status", "balance", "currency")
    search_fields = ("username", "email", "api_token")
