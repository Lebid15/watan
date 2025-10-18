#!/usr/bin/env python
"""Check last order details"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.orders.models import ProductOrder

order = ProductOrder.objects.select_related('package').order_by('-created_at').first()
if not order:
    print("No orders found!")
else:
    pkg = order.package
    print(f"Latest Order:")
    print(f"  ID: {str(order.id)[:8]}...")
    print(f"  Package: {pkg.name if pkg else 'N/A'}")
    print(f"  Package ID: {order.package_id}")
    print(f"  Status: {order.status}")
    print(f"  Provider ID: {order.provider_id or 'None'}")
    print(f"  External Order ID: {order.external_order_id or 'None'}")
    print(f"  Manual Note: {order.manual_note or 'None'}")
    print(f"  Created: {order.created_at}")
