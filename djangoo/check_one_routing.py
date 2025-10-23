import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from apps.package_routing.models import PackageRouting
from apps.products.models import ProductPackage

# Get one of the conflicting routings
routing = PackageRouting.objects.get(id='6b400e01-3883-40e4-bfe7-b678af16599f')
package = ProductPackage.objects.get(id=routing.package_id)

print("=" * 80)
print("مثال على الحزمة المتضاربة:")
print("=" * 80)
print(f"\nPackage Name: {package.name}")
print(f"Package ID: {package.id}")
print(f"\nRouting Configuration:")
print(f"  - Mode: {routing.mode}")
print(f"  - Provider Type: {routing.provider_type}")
print(f"  - Primary Provider: {routing.primary_provider_id}")
print(f"  - Code Group: {routing.code_group_id}")

print("\n" + "=" * 80)
print("المشكلة:")
print("=" * 80)
print(f"  Mode = '{routing.mode}' معناها: النظام يرسل بشكل تلقائي")
print(f"  Provider Type = '{routing.provider_type}' معناها: معالجة يدوية من الأدمن")
print("\n  هذا تناقض! كيف يرسل تلقائي ويدوي بنفس الوقت؟")

print("\n" + "=" * 80)
print("الحل المقترح:")
print("=" * 80)
print("  إذا تبي الحزمة ترسل تلقائي:")
print(f"    UPDATE package_routing SET provider_type='external' WHERE id='{routing.id}';")
print("\n  أو إذا تبيها معالجة يدوية:")
print(f"    UPDATE package_routing SET mode='manual' WHERE id='{routing.id}';")
