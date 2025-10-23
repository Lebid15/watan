from apps.providers.models import Integration
from apps.tenancy.models import Tenant

# Get ALL tenants
print("ALL TENANTS:")
for t in Tenant.objects.all():
    print(f"  {t.id} - {t.name}")

# Get ALL providers
print("\nALL PROVIDERS:")
for p in Integration.objects.all():
    print(f"  {p.id} - Tenant:{p.tenant_id} - Name:{p.name} - Provider:{p.provider}")
