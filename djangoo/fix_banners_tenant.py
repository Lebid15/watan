"""
Script لإصلاح البانرات التي لا تحتوي على tenant_id
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.banners.models import Banner

def fix_banners():
    # البحث عن البانرات بدون tenant_id
    orphan_banners = Banner.objects.filter(tenant_id__isnull=True)
    count = orphan_banners.count()
    
    if count == 0:
        print("✅ جميع البانرات لديها tenant_id")
        return
    
    print(f"⚠️  وجد {count} بانر بدون tenant_id:")
    for banner in orphan_banners:
        print(f"  - Banner ID: {banner.id}, Order: {banner.order}, Created: {banner.created_at}")
    
    # حذف البانرات اليتيمة
    choice = input("\n هل تريد حذف هذه البانرات؟ (yes/no): ").strip().lower()
    if choice == 'yes':
        orphan_banners.delete()
        print(f"✅ تم حذف {count} بانر")
    else:
        print("❌ تم الإلغاء")

if __name__ == '__main__':
    print("=" * 50)
    print("فحص البانرات بدون tenant_id")
    print("=" * 50)
    fix_banners()
    print("\n" + "=" * 50)
    print(f"إجمالي البانرات المتبقية: {Banner.objects.count()}")
    print("=" * 50)
