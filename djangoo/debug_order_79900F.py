"""
Debug script for order 79900F
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting
from django.db import connection

# Find order by short ID or display ID
order_short_id = "A3BBE2"  # Latest order from ShamTech

# Try finding by UUID prefix
orders = ProductOrder.objects.filter(id__startswith=order_short_id[:6].lower())

if not orders.exists():
    # Try finding by last order from ShamTech tenant
    from apps.tenants.models import Tenant
    shamtech = Tenant.objects.filter(name__icontains='shamtech').first()
    if shamtech:
        orders = ProductOrder.objects.filter(tenant_id=shamtech.id).order_by('-created_at')[:5]
        print(f"ℹ️ Couldn't find order by ID. Showing last 5 orders from ShamTech instead:\n")
        for o in orders:
            print(f"   {str(o.id)[:6].upper()} - {o.package.name if o.package else 'N/A'} - {o.status}")
        print()
        if orders.exists():
            order = orders.first()
            print(f"Using most recent order: {str(order.id)[:6].upper()}\n")
    else:
        print(f"❌ No order found and couldn't find ShamTech tenant")
        sys.exit(1)
else:
    order = orders.first()
print(f"\n{'='*80}")
print(f"📦 Order: {str(order.id)[:6].upper()}")
print(f"{'='*80}\n")

print(f"Status: {order.status}")
print(f"Mode: {order.mode}")
print(f"Provider ID: {order.provider_id}")
print(f"External Order ID: {order.external_order_id}")
print(f"External Status: {order.external_status}")
print(f"Package: {order.package.name if order.package else 'N/A'}")
print(f"Tenant ID: {order.tenant_id}")

print(f"\n{'='*80}")
print(f"📋 PackageRouting Configuration")
print(f"{'='*80}\n")

try:
    routing = PackageRouting.objects.get(
        package_id=order.package_id,
        tenant_id=order.tenant_id
    )
    print(f"Mode: {routing.mode}")
    print(f"Provider Type: {routing.provider_type}")
    print(f"Primary Provider ID: {routing.primary_provider_id}")
    
    if routing.primary_provider_id:
        from apps.tenants.models import Tenant
        try:
            provider = Tenant.objects.get(id=routing.primary_provider_id)
            print(f"Provider Name: {provider.name}")
        except Tenant.DoesNotExist:
            print(f"Provider Name: ⚠️ NOT FOUND")
except PackageRouting.DoesNotExist:
    print("❌ No PackageRouting configured for this package/tenant")

print(f"\n{'='*80}")
print(f"📝 Dispatch Logs (last 10)")
print(f"{'='*80}\n")

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT action, result, message, error_details, timestamp
        FROM order_dispatch_log
        WHERE order_id = %s
        ORDER BY timestamp DESC
        LIMIT 10
    """, [str(order.id)])
    
    logs = cursor.fetchall()
    for log in logs:
        action, result, message, error_details, timestamp = log
        print(f"[{timestamp}] {action} - {result}")
        if message:
            print(f"   Message: {message}")
        if error_details:
            print(f"   Error: {error_details}")
        print()

if not logs:
    print("⚠️ No dispatch logs found")
