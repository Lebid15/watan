"""
فحص PackageRouting لجميع باقات PUBG في alsham
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting
from apps.products.models import ProductPackage

alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'

print("="*80)
print("PackageRouting لباقات PUBG في alsham")
print("="*80)

# جلب جميع باقات PUBG
pubg_packages = ProductPackage.objects.filter(
    tenant_id=alsham_tenant_id,
    name__icontains='pubg'
).order_by('name')

print(f"\n📦 وجدت {pubg_packages.count()} باقة PUBG:")

for pkg in pubg_packages:
    routing = PackageRouting.objects.filter(
        package_id=pkg.id,
        tenant_id=alsham_tenant_id
    ).first()
    
    status = "✅" if routing else "❌"
    print(f"\n{status} {pkg.name}")
    print(f"   Package ID: {pkg.id}")
    
    if routing:
        print(f"   Mode: {routing.mode}")
        print(f"   Provider Type: {routing.provider_type}")
        print(f"   Primary Provider ID: {routing.primary_provider_id}")
    else:
        print(f"   ⚠️  لا يوجد PackageRouting!")

print("\n" + "="*80)
