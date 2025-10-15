#!/usr/bin/env python
"""البحث في طلبات شام تيك"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django_tenants.utils import schema_context
from apps.orders.models import ProductOrder

# البحث في schema شام تيك
print("\n🔍 البحث في طلبات ShamTech...")

with schema_context('shamtech'):
    recent_orders = ProductOrder.objects.all().order_by('-created_at')[:10]
    
    print(f"\nآخر {recent_orders.count()} طلبات في ShamTech:")
    
    for order in recent_orders:
        print(f"\n{'='*80}")
        print(f"ID: {order.id}")
        print(f"External Order ID: {order.external_order_id}")
        print(f"Status: {order.status}")
        print(f"Manual Note: {order.manual_note or 'فارغ'}")
        print(f"Provider Message: {order.provider_message or 'فارغ'}")
        print(f"Created: {order.created_at}")
