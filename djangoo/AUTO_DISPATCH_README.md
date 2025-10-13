# ✅ تطبيق التوجيه التلقائي للطلبات (Auto-Dispatch)

## 📌 المشكلة
الطلبات لا تُرسل تلقائياً للمزودين الخارجيين رغم تفعيل auto-routing.

## ✨ الحل
تطبيق منطق `tryAutoDispatch` من الباك ايند القديم في djangoo.

## 🔧 التغييرات

### 1. إضافة دالة `try_auto_dispatch()` في `apps/orders/services.py`
```python
def try_auto_dispatch(order_id: str, tenant_id: Optional[str] = None) -> None
```

**الوظيفة**: 
- فحص إعدادات PackageRouting
- إرسال الطلب للمزود الخارجي إذا كان mode=auto
- تحديث حالة الطلب

### 2. ربط الدالة مع `OrdersCreateView`
```python
# في OrdersCreateView.post()
try:
    try_auto_dispatch(str(order.id), str(tenant_uuid))
except Exception as e:
    logger.warning("Auto-dispatch failed", ...)
```

## 🚀 كيفية الاستخدام

### الإعداد
1. **أنشئ Integration**: `/admin/products/integrations/`
   - اختر المزود (znet, barakat, إلخ)
   - أدخل بيانات الاتصال

2. **اربط الباقة**: في صفحة Integration
   - اذهب لـ Package Mappings
   - اربط الباقة المحلية مع باقة المزود

3. **فعّل Auto-Routing**: `/admin/products/package-routing/`
   - mode = `auto`
   - providerType = `external`
   - primaryProviderId = `<integration-id>`

### الاختبار
أرسل طلب شحن → سيُرسل تلقائياً للمزود → تحديث حالة الطلب

## 📊 النتيجة المتوقعة

### عند النجاح ✅
- `providerId` محدد
- `externalOrderId` محدد
- `externalStatus` = `sent` أو `processing`
- ملاحظة في Notes: `"Auto-dispatch → ext=sent, msg=..."`

### عند الفشل ❌
- الطلب يبقى `pending`
- ملاحظة في Notes: `"Auto-dispatch failed: ..."`

## 📝 الملفات المعدلة
- ✏️ `djangoo/apps/orders/services.py` (+300 سطر)
- ✏️ `djangoo/apps/orders/views.py` (+13 سطر)

## 📚 التوثيق الكامل
راجع: `AUTO_DISPATCH_IMPLEMENTATION.md`

## 🐛 استكشاف الأخطاء

**الطلب لا يُرسل؟**
1. تحقق من PackageRouting (mode=auto, providerType=external)
2. تحقق من PackageMapping
3. راجع logs: `apps.orders.services`

**خطأ "No mapping found"؟**
- أضف mapping في Integration → Package Mappings

## ⚠️ ملاحظات
- لا يفشل إنشاء الطلب إذا فشل التوجيه
- يمكن إعادة المحاولة يدوياً
- مدعوم: znet, barakat
- غير مدعوم بعد: fallback, auto-retry

---

**الحالة**: ✅ جاهز للاختبار  
**التاريخ**: 2025-01-10
