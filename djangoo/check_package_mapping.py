"""
Check Package Mapping between Al-Sham and ShamTech
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageMapping, Integration
from apps.products.models import ProductPackage

# Al-Sham tenant
alsham_id = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"
alsham_package = "a8a02e3a-2f8d-4416-8390-d1a102302c00"

# ShamTech tenant  
shamtech_id = "fd0a6cce-f6e7-4c67-aa6c-a19fcac96536"
shamtech_package = "4b827947-95b3-4ac9-9bfd-a8b3d6dbb095"

print("\n" + "="*80)
print("🔍 Checking Package Mapping")
print("="*80 + "\n")

# Find Integration from Al-Sham to ShamTech
integrations = Integration.objects.filter(tenant_id=alsham_id)
print(f"📡 Integrations from Al-Sham: {integrations.count()}")
for integration in integrations:
    print(f"   - {integration.name} (ID: {str(integration.id)[:8]}...)")
    print(f"     Provider Tenant: {integration.provider_tenant_id}")
print()

# Find Package Mapping
mappings = PackageMapping.objects.filter(
    tenant_package_id=alsham_package
)

print("="*80)
print(f"📦 Package Mappings for Al-Sham's PUBG package: {mappings.count()}")
print("="*80 + "\n")

if mappings.exists():
    for mapping in mappings:
        print(f"Integration ID: {mapping.integration_id}")
        
        # Get provider package name
        provider_pkg = ProductPackage.objects.filter(id=mapping.provider_package_id).first()
        print(f"Provider Package: {provider_pkg.name if provider_pkg else 'Unknown'}")
        print(f"Provider Package ID: {mapping.provider_package_id}")
        print(f"Tenant Package ID: {mapping.tenant_package_id}")
        print()
else:
    print("❌ NO Package Mapping found!")
    print("\nThis is the problem! Al-Sham needs to map:")
    print(f"   Al-Sham package (a8a02e3a...) → ShamTech package (4b827947...)")

print("="*80)
