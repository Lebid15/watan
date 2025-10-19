import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting

print("=" * 80)
print("🔧 إصلاح الطلب الحالي 8e9b008a")
print("=" * 80)

# Find the order
order = ProductOrder.objects.filter(id__startswith='8e9b008a').first()

if order:
    print(f"\n✅ تم العثور على الطلب: {order.id}")
    print(f"  Package: {order.package.name if order.package else 'N/A'}")
    print(f"  Status: {order.status}")
    print(f"  External Status: {order.external_status}")
    
    if order.package:
        # Find and update routing
        routing = PackageRouting.objects.filter(
            tenant_id=order.tenant_id,
            package_id=order.package_id
        ).first()
        
        if routing:
            print(f"\n📍 الـ Routing الحالي:")
            print(f"  Mode: {routing.mode}")
            
            if routing.mode == 'manual':
                routing.mode = 'auto'
                routing.save()
                print(f"\n✅ تم تحديث الـ Routing إلى AUTO")
                print(f"\n💡 الآن Celery سيفحص هذا الطلب في الدورة القادمة (خلال 10 ثوان)")
            else:
                print(f"\n✅ الـ Routing بالفعل في وضع AUTO")
        else:
            print(f"\n⚠️ لم يتم العثور على Routing لهذه الباقة")
            print(f"  سننشئ واحد جديد...")
            
            PackageRouting.objects.create(
                tenant_id=order.tenant_id,
                package_id=order.package_id,
                mode='auto',
                provider_type='manual',
                primary_provider_id=None
            )
            print(f"✅ تم إنشاء Routing جديد بوضع AUTO")
    else:
        print(f"\n⚠️ الطلب ليس له باقة!")
else:
    print(f"\n❌ لم يتم العثور على الطلب!")

print("\n" + "=" * 80)
