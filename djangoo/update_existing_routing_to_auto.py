import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting

print("=" * 80)
print("🔄 تحديث جميع PackageRouting من MANUAL إلى AUTO")
print("=" * 80)

# Find all MANUAL routings
manual_routings = PackageRouting.objects.filter(mode='manual')

print(f"\n📊 تم العثور على {manual_routings.count()} routing بوضع MANUAL")

if manual_routings.count() > 0:
    print("\n🔄 جاري التحديث...")
    
    updated_count = 0
    for routing in manual_routings:
        routing.mode = 'auto'
        routing.save()
        updated_count += 1
        print(f"  ✅ تم تحديث: Package {str(routing.package_id)[:8]}... → AUTO")
    
    print(f"\n✅ تم تحديث {updated_count} routing إلى وضع AUTO")
    print("\n💡 الآن Celery سيفحص جميع الطلبات تلقائياً كل 10 ثوان!")
else:
    print("\n✅ لا توجد routings بحاجة للتحديث")

print("\n" + "=" * 80)
print("✅ تم الانتهاء!")
print("=" * 80)
