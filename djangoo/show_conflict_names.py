import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting
from apps.products.models import ProductPackage
from django.db import connection

routings = PackageRouting.objects.filter(mode='auto', provider_type='manual')

print("=" * 100)
print("الحزم المتضاربة (Mode=auto + Provider Type=manual)")
print("=" * 100)

cursor = connection.cursor()

for i, routing in enumerate(routings, 1):
    print(f"\n[{i}]")
    
    # Get tenant name
    cursor.execute("SELECT name FROM tenant WHERE id = %s", [str(routing.tenant_id)])
    tenant_row = cursor.fetchone()
    tenant_name = tenant_row[0] if tenant_row else "Unknown"
    
    # Get package name
    try:
        package = ProductPackage.objects.get(id=routing.package_id)
        package_name = package.name
    except ProductPackage.DoesNotExist:
        package_name = "Package Not Found"
    
    print(f"  Tenant: {tenant_name}")
    print(f"  Package: {package_name}")
    print(f"  Mode: {routing.mode}")
    print(f"  Provider Type: {routing.provider_type}")
    print("-" * 100)

print(f"\nTotal: {routings.count()} حزمة متضاربة")
