from apps.users.models import User
from django.contrib.auth.hashers import make_password

shamtech_tenant_id = '7d677574-21be-45f7-b520-22e0fe36b860'

print("="*70)
print("CREATING ADMIN USER FOR SHAMTECH")
print("="*70)

# Check existing admin
existing_admin = User.objects.filter(
    tenant_id=shamtech_tenant_id,
    is_staff=True
).first()

if existing_admin:
    print(f"\n✅ Admin user already exists:")
    print(f"   ID: {existing_admin.id}")
    print(f"   Username: {existing_admin.username}")
    print(f"   Email: {existing_admin.email}")
    print(f"   Is Staff: {existing_admin.is_staff}")
    print(f"   Is Active: {existing_admin.is_active}")
else:
    # Create new admin
    admin_user = User.objects.create(
        tenant_id=shamtech_tenant_id,
        username='admin_shamtech',
        password=make_password('admin123'),
        email='admin@shamtech.local',
        is_staff=True,
        is_superuser=True,
        is_active=True
    )
    print(f"\n✅ Created new admin user:")
    print(f"   ID: {admin_user.id}")
    print(f"   Username: {admin_user.username}")
    print(f"   Password: admin123")

print("\n" + "="*70)
print("LOGIN INSTRUCTIONS")
print("="*70)
print("\n1. Go to: http://localhost:3000/login")
print("2. OR: http://shamtech.localhost:3000/login")
print("3. Username: admin_shamtech (or existing admin username)")
print("4. Password: admin123")
print("5. Then go to: /admin/orders")
print("\n" + "="*70)
