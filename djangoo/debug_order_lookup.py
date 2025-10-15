#!/usr/bin/env python
"""عرض معلومات الطلب والبحث في Client API"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

import requests
from apps.orders.models import ProductOrder
from apps.providers.models import Integration

# ID الطلب في الشام
ORDER_ID = '26a577a7-11e4-433f-bfeb-72cf569aee1a'

order = ProductOrder.objects.get(id=ORDER_ID)

print(f"\n{'='*80}")
print(f"معلومات الطلب في الشام:")
print(f"{'='*80}")
print(f"ID: {order.id}")
print(f"External Order ID: {order.external_order_id}")
print(f"Provider ID: {order.provider_id}")
print(f"Status: {order.status}")
print(f"Manual Note: {order.manual_note or 'فارغ'}")

# جلب معلومات المزود (شام تيك)
integration = Integration.objects.get(id=order.provider_id)
print(f"\n{'='*80}")
print(f"معلومات المزود (شام تيك):")
print(f"{'='*80}")
print(f"Provider: {integration.provider}")
print(f"Base URL: {integration.base_url}")
print(f"API Token: {integration.api_token[:20]}...")

# محاولة البحث في Client API بطرق مختلفة
base_url_clean = integration.base_url.replace('http://', '').replace('https://', '').rstrip('/')
tenant_host = base_url_clean.split(':')[0]

headers = {
    'api-token': integration.api_token,
    'X-Tenant-Host': tenant_host,
}

print(f"\n{'='*80}")
print(f"🔍 البحث في Client API...")
print(f"{'='*80}")

# طريقة 1: البحث بـ external_order_id
print(f"\n1️⃣ البحث بـ External Order ID: {order.external_order_id}")
url = 'http://127.0.0.1:8000/client/api/check'
params = {'orders': order.external_order_id, 'uuid': '1'}
response = requests.get(url, params=params, headers=headers, timeout=20)
print(f"   Status: {response.status_code}")
print(f"   Response: {response.text[:500]}")

# طريقة 2: البحث بـ order id الأصلي
print(f"\n2️⃣ البحث بـ Original Order ID: {order.id}")
params = {'orders': str(order.id), 'uuid': '1'}
response = requests.get(url, params=params, headers=headers, timeout=20)
print(f"   Status: {response.status_code}")
print(f"   Response: {response.text[:500]}")

# طريقة 3: عرض آخر الطلبات في شام تيك
print(f"\n3️⃣ آخر الطلبات في شام تيك:")
catalog_url = 'http://127.0.0.1:8000/client/api/orders'
response = requests.get(catalog_url, headers=headers, timeout=20)
if response.status_code == 200:
    data = response.json()
    orders = data.get('data', []) if isinstance(data, dict) else data
    for o in orders[:5]:
        print(f"\n   Order ID: {o.get('id')}")
        print(f"   Status: {o.get('status')}")
        print(f"   Note: {o.get('note') or o.get('manualNote') or 'فارغ'}")
else:
    print(f"   Error: {response.status_code} - {response.text[:200]}")
