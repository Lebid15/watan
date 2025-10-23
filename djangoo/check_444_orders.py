import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("\nChecking orders for user_identifier=444...\n")

orders = ProductOrder.objects.filter(user_identifier='444').order_by('created_at')

print(f"Total orders found: {orders.count()}\n")

for i, order in enumerate(orders, 1):
    # Get tenant name from tenant table
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT name FROM tenant WHERE id = %s", [str(order.tenant_id)])
        result = cursor.fetchone()
        tenant_name = result[0] if result else "Unknown"
    provider_id = str(order.provider_id)[:8] if order.provider_id else "None"
    
    print(f"{i}. Order {str(order.id)[:6]}:")
    print(f"   - Tenant: {tenant_name}")
    print(f"   - Provider ID: {provider_id}")
    print(f"   - Status: {order.status}")
    print(f"   - External Status: {order.external_status}")
    print(f"   - Chain Path: {order.chain_path}")
    print(f"   - External Order ID: {str(order.external_order_id)[:20] if order.external_order_id else 'None'}")
    print()
