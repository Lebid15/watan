"""
Check the original order and the forwarded order
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder

# Original order (from halil at Al-Sham)
original_id = "d8ad170a-9853-43ea-a982-803a10e73be2"
original = ProductOrder.objects.filter(id=original_id).first()

# Forwarded order (at ShamTech)
forwarded_id = "a3bbe2"
forwarded = ProductOrder.objects.filter(id__startswith=forwarded_id).first()

print("\n" + "="*80)
print("ORIGINAL ORDER (Halil → Al-Sham)")
print("="*80)
if original:
    print(f"ID: {str(original.id)[:6].upper()}")
    print(f"Status: {original.status}")
    print(f"Mode: {original.mode}")
    print(f"Provider ID: {original.provider_id}")
    print(f"External Order ID: {original.external_order_id}")
    print(f"Tenant ID: {original.tenant_id}")
else:
    print("❌ Not found")

print("\n" + "="*80)
print("FORWARDED ORDER (Al-Sham → ShamTech)")
print("="*80)
if forwarded:
    print(f"ID: {str(forwarded.id)[:6].upper()}")
    print(f"Status: {forwarded.status}")
    print(f"Mode: {forwarded.mode}")
    print(f"Provider ID: {forwarded.provider_id}")
    print(f"External Order ID: {forwarded.external_order_id}")
    print(f"Tenant ID: {forwarded.tenant_id}")
else:
    print("❌ Not found")
