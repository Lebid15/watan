"""
Find all PUBG Global 325 packages
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.products.models import ProductPackage
from apps.providers.models import PackageRouting
from apps.tenants.models import Tenant

# Find all PUBG packages
packages = ProductPackage.objects.filter(name__icontains='pubg global 325')

print("\n" + "="*80)
print(f"📦 All 'PUBG Global 325' Packages ({packages.count()} found)")
print("="*80 + "\n")

for pkg in packages:
    print(f"Package ID: {pkg.id}")
    print(f"Name: {pkg.name}")
    print(f"Tenant ID: {pkg.tenant_id}")
    
    # Get tenant name
    tenant = Tenant.objects.filter(id=pkg.tenant_id).first()
    print(f"Tenant Name: {tenant.name if tenant else 'Unknown'}")
    
    # Check if routing exists
    routings = PackageRouting.objects.filter(package_id=pkg.id)
    print(f"Routings configured: {routings.count()}")
    
    if routings.exists():
        for routing in routings:
            routing_tenant = Tenant.objects.filter(id=routing.tenant_id).first()
            provider_tenant = Tenant.objects.filter(id=routing.primary_provider_id).first() if routing.primary_provider_id else None
            
            print(f"  - For tenant: {routing_tenant.name if routing_tenant else 'Unknown'} ({routing.tenant_id})")
            print(f"    Mode: {routing.mode}")
            print(f"    Type: {routing.provider_type}")
            print(f"    Provider: {provider_tenant.name if provider_tenant else 'Unknown'} ({routing.primary_provider_id})")
    
    print("-" * 80)
    print()
