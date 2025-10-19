"""
Check PackageRouting for both tenants
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting
from apps.tenants.models import Tenant
from apps.products.models import ProductPackage

# Package: PUBG Global 325
package = ProductPackage.objects.filter(name__icontains='pubg global 325').first()

print("\n" + "="*80)
print(f"📦 Package: {package.name if package else 'NOT FOUND'}")
print(f"Package ID: {package.id if package else 'N/A'}")
print("="*80 + "\n")

# Find all tenants
tenants = Tenant.objects.all()

print("🏢 All Tenants:")
print("="*80 + "\n")
for t in tenants:
    print(f"{str(t.id)[:6].upper()} - {t.name}")
print()

# Al-Sham tenant
alsham_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"
print("="*80)
print("🏢 Al-Sham Tenant Routing")
print("="*80 + "\n")

try:
    routing = PackageRouting.objects.get(
        package_id=package.id,
        tenant_id=alsham_id
    )
    print(f"Mode: {routing.mode}")
    print(f"Provider Type: {routing.provider_type}")
    print(f"Primary Provider ID: {routing.primary_provider_id}")
    
    if routing.primary_provider_id:
        provider = Tenant.objects.filter(id=routing.primary_provider_id).first()
        print(f"Provider Name: {provider.name if provider else 'NOT FOUND'}")
except PackageRouting.DoesNotExist:
    print("❌ No routing configured")

# ShamTech tenant
shamtech_id = "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536"
print("\n" + "="*80)
print("🏢 ShamTech Tenant Routing")
print("="*80 + "\n")

try:
    routing = PackageRouting.objects.get(
        package_id=package.id,
        tenant_id=shamtech_id
    )
    print(f"Mode: {routing.mode}")
    print(f"Provider Type: {routing.provider_type}")
    print(f"Primary Provider ID: {routing.primary_provider_id}")
    
    if routing.primary_provider_id:
        provider = Tenant.objects.filter(id=routing.primary_provider_id).first()
        print(f"Provider Name: {provider.name if provider else 'NOT FOUND'}")
except PackageRouting.DoesNotExist:
    print("❌ No routing configured")

print("\n" + "="*80)
