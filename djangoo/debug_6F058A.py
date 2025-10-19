"""
Debug order 6F058A
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting
from django.db import connection

# Find order
order_id = "0e46dbd0-489a-4f70-a547-d149b5dc67f0"
order = ProductOrder.objects.filter(id=order_id).first()

if not order:
    print(f"❌ Order not found")
    sys.exit(1)

print("\n" + "="*80)
print(f"📦 Order: {str(order.id)[:6].upper()}")
print("="*80 + "\n")

print(f"Full ID: {order.id}")
print(f"Status: {order.status}")
print(f"Mode: {order.mode}")
print(f"Provider ID: {order.provider_id}")
print(f"External Order ID: {order.external_order_id}")
print(f"External Status: {order.external_status}")
print(f"Package: {order.package.name if order.package else 'N/A'}")
print(f"Package ID: {order.package_id}")
print(f"Tenant ID: {order.tenant_id}")

print("\n" + "="*80)
print("📋 PackageRouting Configuration")
print("="*80 + "\n")

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
    print("❌ No PackageRouting configured")

print("\n" + "="*80)
print("🔍 Is this a forwarded order from Al-Sham?")
print("="*80 + "\n")

# Check if this is a forwarded order by looking for the original
if order.external_order_id:
    original = ProductOrder.objects.filter(id=order.external_order_id).first()
    if original:
        print(f"✅ YES - This is a forwarded order")
        print(f"Original Order ID: {str(original.id)[:6].upper()}")
        print(f"Original Tenant: {original.tenant_id}")
        print(f"Original Mode: {original.mode}")
        print(f"Original Provider ID: {original.provider_id}")
    else:
        print(f"⚠️ External Order ID exists but order not found: {order.external_order_id}")
else:
    print(f"❌ NO - This is not a forwarded order (no external_order_id)")

print("\n" + "="*80)
print("📝 Checking if try_auto_dispatch was called")
print("="*80 + "\n")

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT action, result, message, timestamp
        FROM order_dispatch_log
        WHERE order_id = %s
        ORDER BY timestamp DESC
        LIMIT 10
    """, [str(order.id)])
    
    logs = cursor.fetchall()
    if logs:
        for log in logs:
            action, result, message, timestamp = log
            print(f"[{timestamp}] {action} - {result}")
            if message:
                print(f"   Message: {message}")
            print()
    else:
        print("⚠️ No dispatch logs found - try_auto_dispatch was NOT called!")

print("="*80)
