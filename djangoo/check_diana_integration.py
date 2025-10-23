from apps.providers.models import Integration
from apps.users.models import User

alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("CHECKING DIANA INTEGRATION")
print("="*70)

# Find diana integration
diana_integration = Integration.objects.filter(
    tenant_id=alsham_tenant_id,
    name__icontains='diana'
).first()

if diana_integration:
    print(f"\n✅ Found diana integration:")
    print(f"   ID: {diana_integration.id}")
    print(f"   Name: {diana_integration.name}")
    print(f"   Type: {diana_integration.provider_type}")
    print(f"   Tenant: {diana_integration.tenant_id}")
    
    # Check if it has user_id field
    if hasattr(diana_integration, 'user_id'):
        print(f"   User ID: {diana_integration.user_id}")
    else:
        print("   ⚠️ No user_id field in Integration model")
    
    # Check credentials
    print(f"\n   Credentials: {diana_integration.credentials}")
else:
    print("\n❌ Diana integration not found")

# Check diana user in ShamTech
print("\n" + "="*70)
print("DIANA USER IN SHAMTECH")
print("="*70)

diana_user = User.objects.filter(tenant_id=shamtech_tenant_id, username='diana_shamtech').first()

if diana_user:
    print(f"\n✅ Diana user found:")
    print(f"   ID: {diana_user.id}")
    print(f"   Username: {diana_user.username}")
    print(f"   Tenant: {diana_user.tenant_id}")
else:
    print("\n❌ Diana user not found")

print("\n" + "="*70)
print("SOLUTION")
print("="*70)

print("\nThe issue: When forwarding orders from Alsham to ShamTech,")
print("the user_identifier is copied from the original order.")
print("\nWe need to:")
print("1. Either modify the code to use a specific user in target tenant")
print("2. Or create a script to auto-update user_identifier for new orders")

print("\n" + "="*70)
