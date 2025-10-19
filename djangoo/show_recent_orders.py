"""
Show recent orders
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("\n" + "="*80)
print("Last 10 Orders")
print("="*80 + "\n")

orders = ProductOrder.objects.select_related('package', 'user').order_by('-created_at')[:10]

for order in orders:
    tenant_name = str(order.tenant_id)[:6] if order.tenant_id else 'N/A'
    package_name = order.package.name if order.package else 'N/A'
    user_name = order.user.username if order.user else 'N/A'
    
    print(f"{str(order.id)[:6].upper()} | {tenant_name[:15]:15} | {package_name[:25]:25} | {order.status:10} | {order.mode or 'N/A':15} | {user_name}")
