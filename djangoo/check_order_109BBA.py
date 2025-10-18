#!/usr/bin/env python
"""Check order 109BBA"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder

# البحث عن الطلب
order = ProductOrder.objects.filter(id__icontains='109bba').first()
if not order:
    print("❌ Order not found with ID containing '109bba'")
    # البحث في آخر 10 طلبات
    print("\nLast 10 orders:")
    for o in ProductOrder.objects.order_by('-created_at')[:10]:
        order_id = str(o.id)
        print(f"  - ID: {order_id[-6:].upper()} | Package: {str(o.package_id)[:8]}... | Status: {o.status} | Provider: {o.provider_id or 'None'} | External: {o.external_order_id or 'None'}")
else:
    print(f"📦 Order Found: {order.id}")
    print(f"  Package ID: {order.package_id}")
    print(f"  Tenant ID: {order.tenant_id}")
    print(f"  Status: {order.status}")
    print(f"  Provider ID: {order.provider_id or 'None'}")
    print(f"  External Order ID: {order.external_order_id or 'None'}")
    print(f"  External Status: {order.external_status or 'None'}")
    print(f"  Manual Note: {order.manual_note or 'None'}")
    print(f"  Provider Message: {order.provider_message or 'None'}")
    print(f"  Sent At: {order.sent_at or 'None'}")
    print(f"  Created: {order.created_at}")
