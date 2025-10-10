"""
Check product and package images in database
"""
from apps.products.models import Product, ProductPackage
from apps.orders.models import ProductOrder

# Get latest order
order = ProductOrder.objects.select_related('product', 'package').first()

if order:
    print(f"Order ID: {order.id}")
    print(f"\n=== PRODUCT ===")
    if order.product:
        print(f"ID: {order.product.id}")
        print(f"Name: {order.product.name}")
        print(f"custom_image_url: {order.product.custom_image_url}")
        print(f"thumb_small_url: {order.product.thumb_small_url}")
        print(f"thumb_medium_url: {order.product.thumb_medium_url}")
        print(f"thumb_large_url: {order.product.thumb_large_url}")
    else:
        print("No product")
    
    print(f"\n=== PACKAGE ===")
    if order.package:
        print(f"ID: {order.package.id}")
        print(f"Name: {order.package.name}")
        print(f"image_url: {order.package.image_url}")
    else:
        print("No package")
else:
    print("No orders found")

# Check all products
print(f"\n=== ALL PRODUCTS ===")
products = Product.objects.all()[:3]
for p in products:
    print(f"\nProduct: {p.name}")
    print(f"  custom_image_url: {p.custom_image_url}")
    print(f"  thumb_small_url: {p.thumb_small_url}")

print(f"\n=== ALL PACKAGES ===")
packages = ProductPackage.objects.all()[:3]
for pkg in packages:
    print(f"\nPackage: {pkg.name}")
    print(f"  image_url: {pkg.image_url}")
