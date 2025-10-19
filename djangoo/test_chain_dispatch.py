"""
سكريبت لاختبار سيناريو السلسلة الكامل
Khalil → Al-Sham → ShamTech → ZNET
"""
import os
import sys
import django

# إعداد Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from apps.orders.models import ProductOrder
from apps.orders.services import try_auto_dispatch
from django.db import connection

def check_order_status(order_id):
    """فحص حالة الطلب"""
    try:
        order = ProductOrder.objects.get(id=order_id)
        print(f"\n{'='*80}")
        print(f"📋 Order Status Check: {order_id}")
        print(f"{'='*80}")
        print(f"   - Order Status (internal): {order.status}")
        print(f"   - External Status: {order.external_status}")
        print(f"   - Provider ID: {order.provider_id}")
        print(f"   - External Order ID: {order.external_order_id}")
        print(f"   - Mode: {getattr(order, 'mode', 'N/A')}")
        print(f"   - Sent At: {order.sent_at}")
        print(f"   - Last Message: {order.last_message}")
        print(f"{'='*80}\n")
        
        return {
            'status': order.status,
            'external_status': order.external_status,
            'provider_id': str(order.provider_id) if order.provider_id else None,
            'external_order_id': order.external_order_id,
        }
    except ProductOrder.DoesNotExist:
        print(f"❌ Order {order_id} not found!")
        return None

def test_dispatch_flow(order_id, tenant_id):
    """اختبار تدفق الإرسال"""
    print(f"\n{'='*80}")
    print(f"🚀 Testing Dispatch Flow")
    print(f"{'='*80}")
    
    # 1. فحص الحالة قبل الإرسال
    print("\n1️⃣ Before Dispatch:")
    before = check_order_status(order_id)
    
    # 2. إرسال الطلب
    print("\n2️⃣ Dispatching order...")
    try:
        try_auto_dispatch(order_id, tenant_id)
    except Exception as e:
        print(f"❌ Dispatch failed: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 3. فحص الحالة بعد الإرسال مباشرة
    print("\n3️⃣ Immediately After Dispatch:")
    after = check_order_status(order_id)
    
    # 4. التحقق من النتائج
    print("\n4️⃣ Verification:")
    if after:
        if after['status'] == 'approved':
            print(f"   ❌ PROBLEM: Order status is 'approved' immediately after dispatch!")
            print(f"   ⚠️  This is the bug - status should remain 'pending' until Celery confirms")
        elif after['status'] == 'pending':
            print(f"   ✅ CORRECT: Order status is still 'pending'")
        else:
            print(f"   ⚠️  Status: {after['status']}")
        
        if after['external_status'] in ('completed', 'done', 'success'):
            print(f"   ❌ PROBLEM: external_status is terminal '{after['external_status']}'!")
            print(f"   ⚠️  Should be 'sent' or 'processing'")
        elif after['external_status'] in ('sent', 'processing'):
            print(f"   ✅ CORRECT: external_status is '{after['external_status']}'")
        else:
            print(f"   ⚠️  external_status: {after['external_status']}")

if __name__ == '__main__':
    print("\n" + "="*80)
    print("🧪 Patch 5.x - Chain Dispatch Test")
    print("="*80)
    
    if len(sys.argv) < 3:
        print("\n❌ Usage: python test_chain_dispatch.py <order_id> <tenant_id>")
        print("\nExample:")
        print("  python test_chain_dispatch.py ee6ecac5-aa29-4daf-a9f5-94bd7fd4e9ec <tenant_id>")
        sys.exit(1)
    
    order_id = sys.argv[1]
    tenant_id = sys.argv[2]
    
    test_dispatch_flow(order_id, tenant_id)
    
    print("\n" + "="*80)
    print("✅ Test Complete!")
    print("="*80)
