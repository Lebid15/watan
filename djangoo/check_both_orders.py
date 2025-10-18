#!/usr/bin/env python
"""Check both orders"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder

print("="*80)
print("Searching for orders...")
print("="*80)

# البحث عن الطلب الأول (شام تيك)
order1 = ProductOrder.objects.filter(id__icontains='d2ef76').first()
if order1:
    print(f"\n📦 Order 1 (شام تيك): {str(order1.id)[-6:].upper()}")
    print(f"  Full ID: {order1.id}")
    print(f"  Tenant ID: {order1.tenant_id}")
    print(f"  Package ID: {order1.package_id}")
    print(f"  Status: {order1.status}")
    print(f"  Provider ID: {order1.provider_id or 'None'}")
    print(f"  External Order ID: {order1.external_order_id or 'None'}")
    print(f"  External Status: {order1.external_status or 'None'}")
    print(f"  Manual Note: {order1.manual_note or 'None'}")
    print(f"  Created: {order1.created_at}")

# البحث عن الطلب الثاني (الشام)
order2 = ProductOrder.objects.filter(id__icontains='1bc4ee').first()
if order2:
    print(f"\n📦 Order 2 (الشام): {str(order2.id)[-6:].upper()}")
    print(f"  Full ID: {order2.id}")
    print(f"  Tenant ID: {order2.tenant_id}")
    print(f"  Package ID: {order2.package_id}")
    print(f"  Status: {order2.status}")
    print(f"  Provider ID: {order2.provider_id or 'None'}")
    print(f"  External Order ID: {order2.external_order_id or 'None'}")
    print(f"  External Status: {order2.external_status or 'None'}")
    print(f"  Manual Note: {order2.manual_note or 'None'}")
    print(f"  Created: {order2.created_at}")

# التحقق من العلاقة بينهما
if order1 and order2:
    print(f"\n🔍 Relationship Check:")
    if order2.provider_id == str(order1.tenant_id):
        print(f"  ✅ Order 2 (الشام) is forwarded to Order 1's tenant (شام تيك)")
    else:
        print(f"  ❌ No direct relationship found")
        print(f"     Order 2 Provider: {order2.provider_id}")
        print(f"     Order 1 Tenant: {order1.tenant_id}")

print("\n" + "="*80)
