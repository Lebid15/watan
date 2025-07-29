from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import CustomUser, PriceGroup, Currency

class CustomUserAdmin(BaseUserAdmin):
    list_display = ('email', 'balance', 'currency', 'price_group', 'is_staff', 'is_superuser')
    list_filter = ('is_staff', 'is_superuser', 'price_group')
    search_fields = ('email',)
    ordering = ('-date_joined',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('البيانات الشخصية', {
            'fields': (
                'name', 'phone', 'country_code', 'balance',
                'api_token', 'currency', 'price_group'  # ✅ أضفنا currency هنا
            )
        }),
        ('الصلاحيات', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('تواريخ', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'currency', 'price_group'),  # ✅ أضفنا currency هنا
        }),
    )

@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'symbol', 'rate_to_usd')

admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(PriceGroup)
