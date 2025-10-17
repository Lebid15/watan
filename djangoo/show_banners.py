"""
عرض جميع البانرات مع تفاصيل المستأجر
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.banners.models import Banner

def show_banners():
    banners = Banner.objects.all().order_by('tenant_id', 'order')
    
    if banners.count() == 0:
        print("❌ لا توجد بانرات")
        return
    
    print(f"✅ إجمالي البانرات: {banners.count()}\n")
    
    current_tenant = None
    for banner in banners:
        if banner.tenant_id != current_tenant:
            current_tenant = banner.tenant_id
            print(f"\n{'='*60}")
            print(f"المستأجر: {banner.tenant_id}")
            print(f"{'='*60}")
        
        status = "🟢 نشط" if banner.is_active else "🔴 غير نشط"
        print(f"  {status} | Order: {banner.order} | ID: {banner.id}")
        print(f"     الصورة: {banner.image.name if banner.image else 'لا توجد'}")
        if banner.link:
            print(f"     الرابط: {banner.link}")
        print()

if __name__ == '__main__':
    print("=" * 60)
    print("عرض جميع البانرات")
    print("=" * 60)
    show_banners()
