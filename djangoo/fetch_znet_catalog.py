"""
فحص catalog من znet للحصول على provider_package_id الصحيح
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.providers.models import Integration
from apps.providers.adapters.znet import ZnetAdapter, ZnetCredentials

print("="*80)
print("فحص catalog من znet")
print("="*80)

# معلومات shamtech
shamtech_tenant_id = 'fd0a6cce-f6e7-4c67-aa6c-a19fcac96536'  # admin1

# معلومات alayaZnet
znet = Integration.objects.filter(
    name='alayaZnet',
    tenant_id=shamtech_tenant_id
).first()

if not znet:
    print("❌ alayaZnet integration غير موجود!")
    exit(1)

print(f"\n📡 alayaZnet Integration:")
print(f"   ID: {znet.id}")
print(f"   Name: {znet.name}")
print(f"   Provider: {znet.provider}")
print(f"   Base URL: {znet.base_url}")

# إعداد credentials
creds = ZnetCredentials(
    base_url=znet.base_url,
    kod=getattr(znet, 'kod', None) or '',
    sifre=getattr(znet, 'sifre', None) or ''
)

print(f"\n🔑 Credentials:")
print(f"   Base URL: {creds.base_url}")
print(f"   Kod: {'*' * len(creds.kod) if creds.kod else 'MISSING'}")
print(f"   Sifre: {'*' * len(creds.sifre) if creds.sifre else 'MISSING'}")

if not creds.kod or not creds.sifre:
    print("\n❌ Kod أو Sifre مفقود!")
    print("   يجب إضافة kod و sifre في Integration settings")
    exit(1)

# جلب catalog
print(f"\n🔍 جلب catalog من znet...")
adapter = ZnetAdapter()

try:
    catalog = adapter.list_products(creds)
    
    print(f"\n✅ تم جلب {len(catalog)} منتج:")
    
    # البحث عن PUBG
    pubg_products = [p for p in catalog if 'pubg' in str(p.get('name', '')).lower()]
    
    print(f"\n📦 منتجات PUBG ({len(pubg_products)}):")
    for p in pubg_products:  # جميع منتجات PUBG
        product_id = p.get('id') or p.get('externalId') or p.get('referans')
        name = p.get('name')
        
        # البحث عن 180 أو Global
        if '180' in name or 'global' in name.lower():
            print(f"   🎯 ID: {product_id}")
            print(f"      Name: {name}")
            print(f"      Price: {p.get('basePrice') or p.get('cost')} {p.get('currencyCode') or p.get('currency')}")
            print()
        
except Exception as e:
    print(f"\n❌ فشل جلب catalog:")
    print(f"   Error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
