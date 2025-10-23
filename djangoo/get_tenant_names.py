import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from apps.package_routing.models import PackageRouting
from apps.products.models import ProductPackage
from django.db import connection

# Get the conflicting routings
conflicts = [
    ('6b400e01-3883-40e4-bfe7-b678af16599f', '17136ce4-1c04-4b81-8663-87ead4c5c85b', 'pubg global 3850'),
    ('dcab85ab-ba4e-4468-8a17-7cdc55eeeb32', '35e7fe3f-3ed1-463a-9e19-90269db6de93', 'pubg global 1800'),
    ('da69ffb6-5ad6-473c-8759-7f79e377e878', '36f2e41d-0c2d-4cb8-8f9c-05ae2dfa03f6', 'pubg global 180'),
]

print("=" * 100)
print("الحزم التي فيها تناقض:")
print("=" * 100)

for routing_id, package_id, package_name in conflicts:
    try:
        routing = PackageRouting.objects.get(id=routing_id)
        package = ProductPackage.objects.get(id=package_id)
        
        # Get tenant name from tenants table
        with connection.cursor() as cursor:
            cursor.execute("SELECT name FROM tenants WHERE id = %s", [str(routing.tenant_id)])
            tenant_row = cursor.fetchone()
            tenant_name = tenant_row[0] if tenant_row else "Unknown"
        
        print(f"\n{package_name}")
        print(f"  المستأجر: {tenant_name}")
        print(f"  Tenant ID: {routing.tenant_id}")
        print(f"  Package ID: {package_id}")
        print(f"  ")
        print(f"  الإعدادات الحالية:")
        print(f"    - Mode: {routing.mode}")
        print(f"    - Provider Type: {routing.provider_type}")
        print(f"    - Primary Provider: {routing.primary_provider_id or 'None'}")
        print("-" * 100)
        
    except Exception as e:
        print(f"\nخطأ في {package_name}: {e}")
        print("-" * 100)
