from apps.providers.models import Integration
import json

alsham_tenant_id = '7d37f00a-22f3-4e61-88d7-2a97b79d86fb'
diana_user_id = '20'  # Diana user في ShamTech

print("="*70)
print("UPDATING DIANA INTEGRATION")
print("="*70)

diana_integration = Integration.objects.get(
    tenant_id=alsham_tenant_id,
    name='diana'
)

print(f"\nCurrent credentials: {diana_integration.credentials}")

# Parse credentials
if isinstance(diana_integration.credentials, str):
    creds = json.loads(diana_integration.credentials)
else:
    creds = diana_integration.credentials or {}

# Add user_id
creds['user_id'] = diana_user_id
creds['default_user_identifier'] = diana_user_id

# Save
diana_integration.credentials = creds
diana_integration.save()

print(f"\nUpdated credentials: {diana_integration.credentials}")
print("\n✅ Diana integration updated with user_id!")

print("\n" + "="*70)
