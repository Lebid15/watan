"""
Final diagnosis for order 0E46DB at Al-Sham
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import PackageRouting
from apps.products.models import ProductPackage

# Al-Sham order
alsham_order_id = "0e46dbd0-489a-4f70-a547-d149b5dc67f0"
alsham_order = ProductOrder.objects.filter(id=alsham_order_id).first()

print("\n" + "="*80)
print("🔍 DIAGNOSIS - Order at Al-Sham")
print("="*80 + "\n")

print(f"Order ID: {str(alsham_order.id)[:6].upper()}")
print(f"Tenant: Al-Sham ({alsham_order.tenant_id})")
print(f"Package ID: {alsham_order.package_id}")
print(f"Package Name: {alsham_order.package.name if alsham_order.package else 'N/A'}")
print(f"Provider ID: {alsham_order.provider_id}")
print(f"External Order ID: {alsham_order.external_order_id}")

# Find forwarded order at ShamTech
if alsham_order.external_order_id:
    shamtech_order = ProductOrder.objects.filter(id=alsham_order.external_order_id).first()
    
    if shamtech_order:
        print("\n" + "="*80)
        print("🔍 DIAGNOSIS - Forwarded Order at ShamTech")
        print("="*80 + "\n")
        
        print(f"Order ID: {str(shamtech_order.id)[:6].upper()}")
        print(f"Tenant: ShamTech ({shamtech_order.tenant_id})")
        print(f"Package ID: {shamtech_order.package_id}")
        print(f"Package Name: {shamtech_order.package.name if shamtech_order.package else 'N/A'}")
        
        print("\n" + "="*80)
        print("❓ THE PROBLEM")
        print("="*80 + "\n")
        
        # Check if PackageRouting exists for THIS package at ShamTech
        try:
            routing = PackageRouting.objects.get(
                package_id=shamtech_order.package_id,
                tenant_id=shamtech_order.tenant_id
            )
            print(f"✅ PackageRouting EXISTS for this package!")
            print(f"   Mode: {routing.mode}")
            print(f"   Type: {routing.provider_type}")
            print(f"   Provider: {routing.primary_provider_id}")
            print("\n   → Routing is configured correctly!")
            print("   → Problem must be somewhere else...")
            
        except PackageRouting.DoesNotExist:
            print(f"❌ PackageRouting NOT FOUND!")
            print(f"   Package ID at ShamTech: {shamtech_order.package_id}")
            print(f"   Tenant ID: {shamtech_order.tenant_id}")
            print("\n   → This is THE PROBLEM!")
            print("   → The forwarded order has a DIFFERENT package ID")
            print("   → ShamTech doesn't have routing for THIS package")
            
            # Check what package ShamTech DOES have routing for
            print("\n" + "-"*80)
            print("📋 ShamTech's Package Routings:")
            print("-"*80 + "\n")
            
            shamtech_routings = PackageRouting.objects.filter(
                tenant_id=shamtech_order.tenant_id
            )
            
            for r in shamtech_routings:
                pkg = ProductPackage.objects.filter(id=r.package_id).first()
                print(f"   Package: {pkg.name if pkg else 'Unknown'}")
                print(f"   Package ID: {r.package_id}")
                print(f"   Mode: {r.mode}")
                print(f"   Type: {r.provider_type}")
                print()

print("\n" + "="*80)
