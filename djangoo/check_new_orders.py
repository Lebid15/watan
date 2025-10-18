#!/usr/bin/env python
"""Check new orders 27F71B and 52FA70"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting

print("="*80)
print("Checking orders 27F71B (الشام) and 52FA70 (شام تيك)")
print("="*80)

# البحث عن الطلب الأول (الشام)
order1 = ProductOrder.objects.filter(id__icontains='27f71b').first()
if order1:
    print(f"\n📦 Order 1 (الشام): 27F71B")
    print(f"  Full ID: {order1.id}")
    print(f"  Tenant: {order1.tenant_id}")
    print(f"  Package: {order1.package_id}")
    print(f"  Status: {order1.status}")
    print(f"  Provider ID: {order1.provider_id or 'None'}")
    print(f"  External Order ID: {order1.external_order_id or 'None'}")
    print(f"  Manual Note: {(order1.manual_note or 'None')[:50]}")

# البحث عن الطلب الثاني (شام تيك)
order2 = ProductOrder.objects.filter(id__icontains='52fa70').first()
if order2:
    print(f"\n📦 Order 2 (شام تيك): 52FA70")
    print(f"  Full ID: {order2.id}")
    print(f"  Tenant: {order2.tenant_id}")
    print(f"  Package: {order2.package_id}")
    print(f"  Status: {order2.status}")
    print(f"  Provider ID: {order2.provider_id or 'None'}")
    print(f"  External Order ID: {order2.external_order_id or 'None'}")
    print(f"  Manual Note: {(order2.manual_note or 'None')[:50]}")
    
    # فحص routing لهذا الطلب
    print(f"\n🔍 Routing Config for Order 2:")
    routing = PackageRouting.objects.filter(
        package_id=order2.package_id,
        tenant_id=order2.tenant_id
    ).first()
    
    if routing:
        print(f"  ✅ Routing found!")
        print(f"     Mode: {routing.mode}")
        print(f"     Provider Type: {routing.provider_type}")
        print(f"     Code Group ID: {routing.code_group_id or 'None'}")
        
        # فحص الأكواد المتاحة
        if routing.code_group_id:
            from apps.codes.models import CodeGroup
            code_group = CodeGroup.objects.filter(id=routing.code_group_id).first()
            if code_group:
                total = code_group.items.count()
                used = code_group.items.filter(status='used').count()
                available = code_group.items.filter(status='available').count()
                print(f"     📊 Codes: {available} available / {total} total ({used} used)")
    else:
        print(f"  ❌ No routing config found!")

print("\n" + "="*80)
