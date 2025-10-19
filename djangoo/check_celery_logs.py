import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from datetime import timedelta
from django.utils import timezone

print("=" * 80)
print("🔍 Current Order That Should Be Checked")
print("=" * 80)

one_minute_ago = timezone.now() - timedelta(minutes=1)
twenty_four_hours_ago = timezone.now() - timedelta(hours=24)

pending_orders = ProductOrder.objects.filter(
    external_status__in=['pending', 'sent', 'processing'],
    sent_at__isnull=False,
    sent_at__lte=one_minute_ago,
    sent_at__gte=twenty_four_hours_ago
)

print(f"\n📊 Found {pending_orders.count()} orders matching Celery query:")

for order in pending_orders:
    print(f"\n  Order ID: {order.id}")
    print(f"  Tenant: {str(order.tenant_id)[:8]}")
    print(f"  Package: {order.package.name if order.package else 'N/A'}")
    print(f"  Status: {order.status}")
    print(f"  External Status: {order.external_status}")
    print(f"  Provider ID: {order.provider_id or 'NULL'}")
    print(f"  External Order ID: {order.external_order_id or 'NULL'}")
    print(f"  Sent At: {order.sent_at}")
    time_waiting = (timezone.now() - order.sent_at).total_seconds() / 60
    print(f"  ⏱️ Waiting: {int(time_waiting)} minutes")
    
    if order.provider_id:
        from apps.providers.models import Integration
        try:
            integration = Integration.objects.get(id=order.provider_id)
            print(f"  🔌 Provider: {integration.name} (Type: {integration.integration_type})")
            print(f"  🌐 API URL: {integration.api_url or 'N/A'}")
            print(f"  📡 Active: {integration.is_active}")
        except:
            print(f"  ⚠️ Provider not found!")

print("\n" + "=" * 80)
print("✅ Beat is sending tasks every 10 seconds")
print("👀 Watch the Worker window to see order checks!")
print("=" * 80)
