#!/usr/bin/env python
"""البحث عن طلب برقمه"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

# البحث عن الطلب برقم 9AEE1A
orders = ProductOrder.objects.filter(id__icontains='9aee1a')

print(f"النتائج: {orders.count()} طلب")
for order in orders:
    print(f"\n{'='*80}")
    print(f"ID: {order.id}")
    print(f"External Order ID: {order.external_order_id}")
    print(f"Status: {order.status}")
    print(f"Manual Note: {order.manual_note or 'فارغ'}")
    print(f"Provider Message: {order.provider_message or 'فارغ'}")
    print(f"Provider ID: {order.provider_id}")
    print(f"{'='*80}")
