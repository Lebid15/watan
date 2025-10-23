import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from apps.orders.models import LegacyUser

# Check ShamTech tenant
shamtech_tenant = '7d677574-21be-45f7-b520-22e0fe36b860'
print(f"Looking for users in 'users' table (LegacyUser) for ShamTech tenant: {shamtech_tenant}\n")

users = LegacyUser.objects.filter(tenant_id=shamtech_tenant)
print(f"Found {users.count()} users in legacy 'users' table")

for user in users:
    print(f"  ID: {user.id} (UUID)")
    print(f"  Username: {user.username}")
    print(f"  Email: {user.email}")
    print(f"  Tenant: {user.tenant_id}")
    print()

# Also check if diana_shamtech exists by username
diana_users = LegacyUser.objects.filter(username='diana_shamtech')
print(f"\nSearching for 'diana_shamtech' by username: {diana_users.count()} found")
for user in diana_users:
    print(f"  ID: {user.id}")
    print(f"  Tenant: {user.tenant_id}")
