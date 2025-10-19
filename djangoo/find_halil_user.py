"""
البحث عن معرف المستخدم halil في مستأجر alsham
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.legacy_models import LegacyUser
from apps.products.models import ProductPackage

ALSHAM_TENANT_ID = "7d37f00a-22f3-4e61-88d7-2a97b79d86fb"

print("=" * 80)
print("🔍 البحث عن المستخدم halil في alsham")
print("=" * 80)

# البحث عن المستخدم halil
print("\n[Step 1] البحث عن المستخدم halil...")
users = LegacyUser.objects.filter(
    tenant_id=ALSHAM_TENANT_ID,
    username__icontains='halil'
).values('id', 'username', 'email', 'tenant_id')

if users:
    print(f"✅ تم العثور على {len(users)} مستخدم:")
    for user in users:
        print(f"\n   المستخدم:")
        print(f"   - ID: {user['id']}")
        print(f"   - Username: {user['username']}")
        print(f"   - Email: {user['email']}")
        print(f"   - Tenant ID: {user['tenant_id']}")
else:
    print("❌ لم يتم العثور على المستخدم halil")
    
    # البحث عن أي مستخدم في alsham
    print("\n[Alternative] البحث عن جميع المستخدمين في alsham...")
    all_users = LegacyUser.objects.filter(tenant_id=ALSHAM_TENANT_ID).values(
        'id', 'username', 'email'
    )[:10]
    
    print(f"\nالمستخدمين المتاحين في alsham (أول 10):")
    for user in all_users:
        print(f"   - {user['username']} ({user['email']})")

# البحث عن باقة pubg global 180
print("\n[Step 2] البحث عن باقة pubg global 180...")
package = ProductPackage.objects.filter(
    tenant_id=ALSHAM_TENANT_ID,
    name__icontains='pubg global 180'
).first()

if package:
    print(f"✅ تم العثور على الباقة:")
    print(f"   - ID: {package.id}")
    print(f"   - Name: {package.name}")
    print(f"   - Product ID: {package.product_id}")
    print(f"   - Base Price: {package.base_price}")
else:
    print("❌ لم يتم العثور على باقة pubg global 180")

print("\n" + "=" * 80)
