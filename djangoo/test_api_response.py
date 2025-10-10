import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

import json
from apps.orders.views import AdminOrdersListView
from django.test import RequestFactory
from apps.users.models import User as DjangoUser

# Create a fake request
factory = RequestFactory()
request = factory.get('/api-dj/admin/orders/?limit=1')

# Get a user to simulate authentication
user = DjangoUser.objects.first()
request.user = user

# Add tenant header
request.META['HTTP_X_TENANT_ID'] = str(user.tenant_id) if user else ''

# Call the view
view = AdminOrdersListView()
view.request = request
response = view.get(request)

# Print the response
data = response.data
if 'items' in data and len(data['items']) > 0:
    first_order = data['items'][0]
    print("=" * 80)
    print("أول طلب في الـ API Response:")
    print("=" * 80)
    print(json.dumps(first_order, indent=2, ensure_ascii=False))
    print("\n" + "=" * 80)
    print("القيم المالية:")
    print(f"  costTRY: {first_order.get('costTRY')}")
    print(f"  sellTRY: {first_order.get('sellTRY')}")
    print(f"  profitTRY: {first_order.get('profitTRY')}")
    print(f"  currencyTRY: {first_order.get('currencyTRY')}")
    print("=" * 80)
else:
    print("No orders found")
