#!/usr/bin/env python
"""
Script to add PackageRouting for PUBG 660 package.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import connection
from apps.codes.models import CodeGroup

def main():
    tenant_id = 'fd0a6cce-f6e7-4c67-aa6c-a19fcac96536'  # شام تيك
    package_id = '9d94aa49-6c7a-4dd2-bbfd-a8ed3c7079d9'  # pubg global 660 (الباقة الصحيحة)
    
    # البحث عن مجموعة الأكواد
    group = CodeGroup.objects.filter(tenant_id=tenant_id, name__icontains='pubg').first()
    if group:
        print(f'✅ Code Group found: {group.name} (ID: {group.id})')
    else:
        print('❌ No code group found for PUBG!')
        print('Available groups:')
        for g in CodeGroup.objects.filter(tenant_id=tenant_id):
            print(f'  - {g.name} (ID: {g.id})')
        return
    
    # إضافة التوجيه
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO package_routing (id, "tenantId", package_id, mode, "providerType", "codeGroupId")
            VALUES (gen_random_uuid(), %s, %s, 'auto', 'codes', %s)
            ON CONFLICT (package_id, "tenantId") DO UPDATE
            SET mode = 'auto', "providerType" = 'codes', "codeGroupId" = %s
            RETURNING id
            """,
            [tenant_id, package_id, str(group.id), str(group.id)]
        )
        result = cursor.fetchone()
        if result:
            print(f'✅ Routing created/updated successfully! ID: {result[0]}')
        else:
            print('⚠️ Failed to create routing')
    
    # التحقق
    from apps.providers.models import PackageRouting
    routing = PackageRouting.objects.filter(package_id=package_id, tenant_id=tenant_id).first()
    if routing:
        print(f'\n📋 Routing Configuration:')
        print(f'   Mode: {routing.mode}')
        print(f'   Provider Type: {routing.provider_type}')
        print(f'   Code Group ID: {routing.code_group_id}')
    else:
        print('\n❌ Routing not found after insertion!')

if __name__ == '__main__':
    main()
