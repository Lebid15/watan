import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import PackageRouting, Integration
from apps.products.models import ProductPackage
from django.db import connection

print("=" * 100)
print("CHECKING ALL PACKAGE ROUTING CONFIGURATIONS")
print("=" * 100)

# Get all routings
routings = PackageRouting.objects.all().order_by('tenant_id', 'package_id')

print(f"\nTotal routings found: {routings.count()}\n")

# Check for potential conflicts
conflicts = []
issues = []

for routing in routings:
    has_issue = False
    issue_details = {
        'routing_id': str(routing.id),
        'tenant_id': str(routing.tenant_id),
        'package_id': str(routing.package_id),
        'mode': routing.mode,
        'provider_type': routing.provider_type,
        'primary_provider_id': str(routing.primary_provider_id) if routing.primary_provider_id else None,
        'code_group_id': str(routing.code_group_id) if routing.code_group_id else None,
        'problems': []
    }
    
    # Get package name
    try:
        package = ProductPackage.objects.get(id=routing.package_id)
        issue_details['package_name'] = package.name
    except:
        issue_details['package_name'] = 'Unknown'
    
    # Get tenant name
    with connection.cursor() as cursor:
        cursor.execute('SELECT name FROM tenants WHERE id = %s', [routing.tenant_id])
        tenant = cursor.fetchone()
        issue_details['tenant_name'] = tenant[0] if tenant else 'Unknown'
    
    # Check for conflicts
    
    # Conflict 1: Auto mode with manual provider type
    if routing.mode == 'auto' and routing.provider_type == 'manual':
        issue_details['problems'].append("CONFLICT: mode=auto but provider_type=manual")
        has_issue = True
    
    # Conflict 2: Auto mode with external but no provider
    if routing.mode == 'auto' and routing.provider_type == 'external' and not routing.primary_provider_id:
        issue_details['problems'].append("CONFLICT: mode=auto + provider_type=external but no primary_provider_id")
        has_issue = True
    
    # Conflict 3: Auto mode with codes but no code_group
    if routing.mode == 'auto' and routing.provider_type == 'codes' and not routing.code_group_id:
        issue_details['problems'].append("CONFLICT: mode=auto + provider_type=codes but no code_group_id")
        has_issue = True
    
    # Conflict 4: External type but no provider
    if routing.provider_type == 'external' and not routing.primary_provider_id:
        issue_details['problems'].append("⚠️ WARNING: provider_type=external but no primary_provider_id")
        has_issue = True
    
    # Conflict 5: Codes type but no code_group
    if routing.provider_type == 'codes' and not routing.code_group_id:
        issue_details['problems'].append("⚠️ WARNING: provider_type=codes but no code_group_id")
        has_issue = True
    
    if has_issue:
        issues.append(issue_details)

# Print results
if issues:
    print("\nFOUND ISSUES IN PACKAGE ROUTING:")
    print("=" * 100)
    
    for i, issue in enumerate(issues, 1):
        print(f"\n[Issue #{i}]")
        print(f"  Tenant: {issue['tenant_name']} ({issue['tenant_id'][:8]}...)")
        print(f"  Package: {issue['package_name']} ({issue['package_id'][:8]}...)")
        print(f"  Routing ID: {issue['routing_id'][:8]}...")
        print(f"  Mode: {issue['mode']}")
        print(f"  Provider Type: {issue['provider_type']}")
        print(f"  Primary Provider ID: {issue['primary_provider_id'][:8] if issue['primary_provider_id'] else 'None'}...")
        print(f"  Code Group ID: {issue['code_group_id'][:8] if issue['code_group_id'] else 'None'}...")
        
        print(f"\n  Problems:")
        for problem in issue['problems']:
            print(f"    {problem}")
        
        print()
    
    print("=" * 100)
    print(f"\nTotal issues found: {len(issues)}")
    
    # Suggest fixes
    print("\nSUGGESTED FIXES:")
    print("-" * 100)
    
    for i, issue in enumerate(issues, 1):
        print(f"\n[Fix for Issue #{i}] - {issue['package_name']} in {issue['tenant_name']}:")
        
        if "mode=auto but provider_type=manual" in str(issue['problems']):
            print("  Option A: Change mode to 'manual' (if manual processing is intended)")
            print(f"    UPDATE package_routing SET mode='manual' WHERE id='{issue['routing_id']}';")
            print("  Option B: Change provider_type to 'external' or 'codes' (if auto-dispatch is intended)")
            print(f"    UPDATE package_routing SET provider_type='external' WHERE id='{issue['routing_id']}';")
        
        if "mode=auto + provider_type=external but no primary_provider_id" in str(issue['problems']):
            print("  Option A: Set primary_provider_id to a valid provider")
            print(f"    -- First find available providers for this tenant:")
            print(f"    SELECT id, name, provider FROM integrations WHERE \"tenantId\"='{issue['tenant_id']}';")
            print(f"    -- Then update:")
            print(f"    UPDATE package_routing SET \"primaryProviderId\"='<provider_id>' WHERE id='{issue['routing_id']}';")
            print("  Option B: Change provider_type to 'codes' if using code groups")
            print(f"    UPDATE package_routing SET provider_type='codes', \"codeGroupId\"='<code_group_id>' WHERE id='{issue['routing_id']}';")
        
        if "mode=auto + provider_type=codes but no code_group_id" in str(issue['problems']):
            print("  Set code_group_id to a valid code group")
            print(f"    -- First find available code groups for this tenant:")
            print(f"    SELECT id, name FROM code_groups WHERE \"tenantId\"='{issue['tenant_id']}';")
            print(f"    -- Then update:")
            print(f"    UPDATE package_routing SET \"codeGroupId\"='<code_group_id>' WHERE id='{issue['routing_id']}';")

else:
    print("\nNO CONFLICTS FOUND! All package routings are configured correctly.")
    print("\nAll routings checked:")
    print("-" * 100)
    
    for routing in routings[:10]:  # Show first 10 as sample
        try:
            package = ProductPackage.objects.get(id=routing.package_id)
            package_name = package.name
        except:
            package_name = 'Unknown'
        
        with connection.cursor() as cursor:
            cursor.execute('SELECT name FROM tenants WHERE id = %s', [routing.tenant_id])
            tenant = cursor.fetchone()
            tenant_name = tenant[0] if tenant else 'Unknown'
        
        print(f"  OK: {tenant_name} - {package_name} - mode={routing.mode}, type={routing.provider_type}")
    
    if routings.count() > 10:
        print(f"  ... and {routings.count() - 10} more")

print("\n" + "=" * 100)
