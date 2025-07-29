from django.urls import path
from .views import (
    product_list,
    product_detail,
    create_order,
    my_orders,
)
from . import views_admin
from .views_admin import all_packages_with_prices, update_package_price


urlpatterns = [
    # 🛒 الطلبات (مستخدم)
    path('orders/create/', create_order, name='create-order'),
    path('my-orders/', my_orders, name='my-orders'),

    # 📦 المنتجات (عام)
    path('', product_list, name='product-list'),
    path('<slug:slug>/', product_detail, name='product-detail'),

    # 👨‍💼 الإدارة (منتجات وباقات وطلبات)
    path('admin/products/create/', views_admin.create_product_with_packages, name='admin-create-product'),
    path('admin/products/<int:id>/', views_admin.product_detail_by_id, name='admin-product-detail-by-id'),
    path('admin/products/<int:product_id>/add-package/', views_admin.add_package_to_product, name='admin-add-package'),
    path('admin/packages/<int:package_id>/update/', views_admin.update_package, name='admin-update-package'),
    path('admin/packages/<int:package_id>/delete/', views_admin.delete_package, name='admin-delete-package'),

    path('admin/orders/', views_admin.list_all_orders, name='admin-orders'),
    path('admin/orders/<int:order_id>/review/', views_admin.review_order, name='admin-review-order'),
    path('admin/price-groups/packages/', views_admin.list_package_prices, name='admin-price-group-packages'),

    path('admin/all-packages/', all_packages_with_prices, name='all-packages'),
    path('admin/update-price/', update_package_price, name='update-price'),

]
