from apps.orders.models import ProductOrder
from apps.tenancy.models import Tenant

print(f"{'='*70}")
print(f"📊 FULL ORDER TRACKING")
print(f"{'='*70}")

# Order 1: Original order in ALSHAM
order1 = ProductOrder.objects.get(id='2fd6924c-d783-4ae2-9946-0b7a3b7bafcd')
tenant1 = Tenant.objects.get(id=order1.tenant_id)

print(f"\n🔵 ORDER #1 في الشام (ALSHAM)")
print(f"-" * 70)
print(f"Order ID: {order1.id}")
print(f"Order No: {str(order1.id)[-6:].upper()}")
print(f"Tenant: {tenant1.name} (ID: {tenant1.id})")
print(f"Status: {order1.status}")
print(f"External Status: {order1.external_status}")
print(f"External Order ID: {order1.external_order_id}")
print(f"Provider ID: {order1.provider_id}")

# Order 2: New forwarded order in SHAMTECH
new_order_id = 'c98ea6ff-a5ea-4945-8004-964089c51055'
try:
    order2 = ProductOrder.objects.get(id=new_order_id)
    tenant2 = Tenant.objects.get(id=order2.tenant_id)
    
    print(f"\n🟢 ORDER #2 في شام تيك (SHAMTECH) - الطلب الجديد!")
    print(f"-" * 70)
    print(f"Order ID: {order2.id}")
    print(f"Order No: {str(order2.id)[-6:].upper()}")
    print(f"Tenant: {tenant2.name} (ID: {tenant2.id})")
    print(f"Status: {order2.status}")
    print(f"External Status: {order2.external_status}")
    print(f"External Order ID: {order2.external_order_id}")
    print(f"Provider ID: {order2.provider_id}")
    print(f"User Identifier: {order2.user_identifier}")
    print(f"Package ID: {order2.package_id}")
    
    print(f"\n{'='*70}")
    print(f"✅ الطلب تم توجيهه بنجاح من الشام إلى شام تيك!")
    print(f"{'='*70}")
    print(f"الطلب الأصلي (الشام): {str(order1.id)[-6:].upper()}")
    print(f"  → تم توجيهه إلى →")
    print(f"الطلب الجديد (شام تيك): {str(order2.id)[-6:].upper()}")
    
except ProductOrder.DoesNotExist:
    print(f"\n❌ الطلب الجديد {new_order_id} غير موجود!")
    print(f"   يبدو أن التوجيه فشل.")

print(f"\n{'='*70}")
