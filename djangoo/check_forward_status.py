#!/usr/bin/env python
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

with connection.cursor() as c:
    c.execute('''
        SELECT 
            id, 
            root_order_id, 
            "forwardedTo", 
            "forwardedFrom",
            "providerId"
        FROM product_orders 
        WHERE id = %s
    ''', ['f7ff33b5-220b-43fb-995e-2a38d8ff590f'])
    
    result = c.fetchone()
    if result:
        print(f"Order ID: {result[0]}")
        print(f"Root Order: {result[1]}")
        print(f"Forwarded To: {result[2]}")
        print(f"Forwarded From: {result[3]}")
        print(f"Provider ID: {result[4]}")
    else:
        print("Order not found")
