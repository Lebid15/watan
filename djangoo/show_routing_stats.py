import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting

print("=" * 80)
print("إحصائيات PackageRouting بعد التصحيح")
print("=" * 80)
print(f"\nإجمالي الحزم: {PackageRouting.objects.count()}")
print("\nحسب النوع:")
print(f"  ✓ mode=manual + provider_type=manual: {PackageRouting.objects.filter(mode='manual', provider_type='manual').count()}")
print(f"  ✓ mode=auto + provider_type=external: {PackageRouting.objects.filter(mode='auto', provider_type='external').count()}")
print(f"  ✓ mode=auto + provider_type=internal_codes: {PackageRouting.objects.filter(mode='auto', provider_type='internal_codes').count()}")
print(f"\n  ✗ تناقضات (auto+manual): {PackageRouting.objects.filter(mode='auto', provider_type='manual').count()}")
print("\n" + "=" * 80)
