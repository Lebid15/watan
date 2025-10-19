import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

print("=" * 80)
print("🔍 Checking PENDING Order a720bc in Alsham")
print("=" * 80)

order = ProductOrder.objects.filter(
    id__startswith='a720bc',
    tenant_id='7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
).first()

if order:
    print(f"  Full ID: {order.id}")
    print(f"  Tenant: alsham ({order.tenant_id})")
    print(f"  Package: {order.package.name}")
    print(f"  Status: {order.status}")
    print(f"  External Order ID: {order.external_order_id or 'NOT SET'}")
    print(f"  Provider ID: {order.provider_id or 'NOT SET'}")
    print(f"  Provider Referans: {order.provider_referans or 'NOT SET'}")
    print(f"  Created: {order.created_at}")
    
    # Check routing
    print(f"\n  📋 Order Details:")
    print(f"    Price: ${order.price}")
    print(f"    Mode: {order.mode}")
    print(f"    External Status: {order.external_status}")
    
    # Check if forwarded from somewhere
    forwarded_from = ProductOrder.objects.filter(
        forwarded_to_order_id=order.id
    ).first()
    
    if forwarded_from:
        print(f"\n  📥 Forwarded from:")
        print(f"    Tenant: {forwarded_from.tenant_id}")
        print(f"    Order ID: {forwarded_from.id}")
    else:
        print(f"\n  ℹ️ Not a forwarded order (created directly in alsham)")
    
    # Check if forwarded to somewhere else
    if order.forwarded_to_order_id:
        forwarded_to = ProductOrder.objects.filter(
            id=order.forwarded_to_order_id
        ).first()
        if forwarded_to:
            print(f"\n  📤 Forwarded to:")
            print(f"    Tenant: {forwarded_to.tenant_id}")
            print(f"    Order ID: {forwarded_to.id}")
            print(f"    Status: {forwarded_to.status}")
    
    print(f"\n  💡 This order is PENDING in alsham")
    print(f"     Celery should check this order!")
    print(f"     Why isn't it being checked?")
else:
    print("\n  ❌ Order not found!")

print("\n" + "=" * 80)
