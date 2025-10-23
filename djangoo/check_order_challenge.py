#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from apps.orders.models import ProductOrder

order_id = '2fd6924c-d783-4ae2-9946-0b7a3b7bafcd'
order = ProductOrder.objects.filter(id=order_id).first()

if not order:
    print(f"❌ Order {order_id} not found!")
else:
    print(f"\n{'='*60}")
    print(f"📦 ORDER DETAILS")
    print(f"{'='*60}")
    print(f"Order ID: {order.id}")
    print(f"Tenant: {order.tenant.slug if order.tenant else 'N/A'} ({order.tenant.name if order.tenant else 'N/A'})")
    print(f"Product: {order.package.product.name if order.package else 'N/A'}")
    print(f"Package: {order.package.name if order.package else 'N/A'}")
    print(f"Status: {order.status}")
    print(f"External Status: {order.external_status}")
    print(f"Provider: {order.provider.name if order.provider else 'Manual'}")
    print(f"User Identifier: {order.user_identifier}")
    print(f"Quantity: {order.quantity}")
    print(f"Price: {order.price} USD")
    print(f"Sell Price: {order.sell_price_amount} {order.sell_price_currency}")
    print(f"Created: {order.created_at}")
    print(f"Mode: {order.mode or 'AUTO'}")
    print(f"External Order ID: {order.external_order_id or 'N/A'}")
    print(f"Chain Path: {order.chain_path or 'N/A'}")
    print(f"{'='*60}\n")
