import os
import sys
import django

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User as DjangoUser
from apps.users.legacy_models import LegacyUser
from apps.tenants.models import TenantDomain
from django.db.models import Q

print("=" * 60)
print("البحث عن مستخدم خليل")
print("=" * 60)

# البحث عن نطاق alsham
domain = TenantDomain.objects.filter(domain='alsham.localhost').first()
print(f'\n1. Domain: {domain}')
if domain:
    print(f'   Tenant ID: {domain.tenant_id}')

# البحث عن مستخدم خليل في Django
django_users = DjangoUser.objects.filter(Q(username__icontains='khalil') | Q(username__icontains='halil') | Q(email__icontains='khalil') | Q(email__icontains='halil'))
print(f'\n2. Django Users found: {django_users.count()}')
for u in django_users[:10]:
    print(f'   - Username: {u.username}')
    print(f'     Email: {u.email}')
    print(f'     ID: {u.id}')
    print(f'     Tenant ID: {getattr(u, "tenant_id", None)}')
    print()

# البحث عن خليل في LegacyUser
if domain:
    print(f'\n3. البحث في LegacyUser for tenant_id: {domain.tenant_id}')
    legacy_users = LegacyUser.objects.filter(tenant_id=domain.tenant_id)
    total = legacy_users.count()
    print(f'   Total legacy users in alsham tenant: {total}')
    
    legacy_users_khalil = legacy_users.filter(Q(username__icontains='khalil') | Q(username__icontains='halil') | Q(email__icontains='khalil') | Q(email__icontains='halil'))
    print(f'   Legacy Users matching khalil/halil: {legacy_users_khalil.count()}')
    for lu in legacy_users_khalil[:10]:
        print(f'   - Username: {lu.username}')
        print(f'     Email: {lu.email}')
        print(f'     ID: {lu.id}')
        print(f'     Tenant ID: {lu.tenant_id}')
        print()

# البحث بطريقة أخرى - جميع Django users في alsham tenant
if domain:
    print(f'\n4. All Django Users in alsham tenant:')
    django_users_alsham = DjangoUser.objects.filter(tenant_id=domain.tenant_id)
    print(f'   Total: {django_users_alsham.count()}')
    for u in django_users_alsham[:10]:
        print(f'   - {u.username} ({u.email}) - ID: {u.id}')

print("\n" + "=" * 60)
