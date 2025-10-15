"""
تحديث ملاحظة الطلب من المزود الداخلي (شام تيك)
"""
import os
import django
import sys

# Setup Django
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)
sys.path.insert(0, current_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.providers.models import Integration, PackageRouting
from apps.providers.adapters import resolve_adapter_credentials

# معرف الطلب الذي نريد تحديثه
ORDER_ID = '26a577a7-11e4-433f-bfeb-72cf569aee1a'

print(f"\n{'='*80}")
print(f"🔄 تحديث ملاحظة الطلب من المزود...")
print(f"{'='*80}\n")

try:
    # 1. جلب الطلب
    order = ProductOrder.objects.get(id=ORDER_ID)
    print(f"✅ تم العثور على الطلب:")
    print(f"   - ID: {order.id}")
    print(f"   - Status: {order.status}")
    print(f"   - External Order ID: {order.external_order_id}")
    print(f"   - Provider ID: {order.provider_id}")
    print(f"   - Current manualNote: {order.manual_note or 'فارغ'}")
    
    # 2. جلب معلومات المزود
    if not order.provider_id:
        print("\n❌ الطلب ليس لديه provider_id")
        sys.exit(1)
    
    integration = Integration.objects.get(id=order.provider_id)
    print(f"\n📡 معلومات المزود:")
    print(f"   - Provider: {integration.provider}")
    print(f"   - Base URL: {integration.base_url}")
    
    # 3. الحصول على credentials
    binding, creds = resolve_adapter_credentials(
        integration.provider,
        base_url=integration.base_url,
        api_token=getattr(integration, 'api_token', None),
        kod=getattr(integration, 'kod', None),
        sifre=getattr(integration, 'sifre', None),
    )
    
    if not binding or not creds:
        print("\n❌ فشل في الحصول على credentials")
        sys.exit(1)
    
    print(f"✅ تم الحصول على Adapter credentials")
    
    # 4. جلب حالة الطلب من المزود
    # استخدم order.id الأصلي، ليس external_order_id
    referans = str(order.id)
    print(f"\n🔍 جلب الحالة من المزود...")
    print(f"   - Reference: {referans}")
    
    result = binding.adapter.fetch_status(creds, referans)
    
    print(f"\n📥 استجابة المزود:")
    print(f"   - Status: {result.get('status')}")
    print(f"   - Message: {result.get('message')}")
    print(f"   - PIN Code: {result.get('pinCode')}")
    
    # 5. تحديث الطلب
    message = result.get('message') or result.get('note')
    pin_code = result.get('pinCode')
    
    if message:
        order.manual_note = message[:500]
        order.provider_message = message[:250]
        order.last_message = message[:250]
        print(f"\n✅ تم تحديث الملاحظة:")
        print(f"   - manualNote: {order.manual_note}")
    
    if pin_code:
        order.pin_code = pin_code
        print(f"✅ تم تحديث PIN Code: {pin_code[:10]}...")
    
    order.save()
    
    print(f"\n{'='*80}")
    print(f"✅ تم تحديث الطلب بنجاح!")
    print(f"{'='*80}\n")
    
except ProductOrder.DoesNotExist:
    print(f"\n❌ الطلب غير موجود: {ORDER_ID}")
    sys.exit(1)

except Exception as e:
    print(f"\n❌ خطأ: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
