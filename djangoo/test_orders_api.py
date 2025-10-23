# -*- coding: utf-8 -*-
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User as DjangoUser
from apps.tenants.models import TenantDomain
from django.test import RequestFactory
from rest_framework.test import force_authenticate
from apps.orders.views import MyOrdersListView

print("=" * 60)
print("Testing MyOrdersListView")
print("=" * 60)

# Get alsham tenant
domain = TenantDomain.objects.filter(domain='alsham.localhost').first()
tenant_id = domain.tenant_id

# Get Django user
django_user = DjangoUser.objects.filter(username='halil', tenant_id=tenant_id).first()
print(f"\nDjango User: {django_user.username} (ID: {django_user.id})")

# Create a mock request
factory = RequestFactory()
request = factory.get('/api-dj/orders/me', HTTP_X_TENANT_HOST='alsham.localhost', HTTP_X_TENANT_ID=str(tenant_id))
force_authenticate(request, user=django_user)

# Call the view
view = MyOrdersListView.as_view()
response = view(request)

print(f"\nResponse status: {response.status_code}")
print(f"Response data type: {type(response.data)}")

if response.status_code == 200:
    if isinstance(response.data, dict):
        items = response.data.get('items', [])
        page_info = response.data.get('pageInfo', {})
        print(f"Items count: {len(items)}")
        print(f"Has more: {page_info.get('hasMore')}")
        print(f"Next cursor: {page_info.get('nextCursor')}")
        
        if items:
            print(f"\nFirst order:")
            first = items[0]
            print(f"  ID: {first.get('id')}")
            print(f"  Status: {first.get('status')}")
            print(f"  Created: {first.get('createdAt')}")
    else:
        print(f"Unexpected response format: {response.data}")
else:
    print(f"Error response: {response.data}")

print("=" * 60)
