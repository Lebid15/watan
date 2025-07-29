from django.contrib import admin
from .models import Product, ProductPackage, ProductOrder, PackagePrice

class ProductPackageInline(admin.TabularInline):
    model = ProductPackage
    extra = 1
    fields = ('name', 'description', 'base_price', 'is_active')  # ✅ نعرض base_price هنا

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    inlines = [ProductPackageInline]
    exclude = ['slug']

@admin.register(ProductOrder)
class ProductOrderAdmin(admin.ModelAdmin):
    list_display = ('user', 'package', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('user__email', 'package__name')
    list_editable = ('status',)

@admin.register(PackagePrice)
class PackagePriceAdmin(admin.ModelAdmin):
    list_display = ('package', 'group', 'price')
    list_filter = ('group', 'package')
    search_fields = ('package__name', 'group__name')
