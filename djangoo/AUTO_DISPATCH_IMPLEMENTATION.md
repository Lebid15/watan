# تطبيق التوجيه التلقائي للطلبات (Auto-Dispatch)

## نظرة عامة

تم تطبيق منطق التوجيه التلقائي للطلبات من الباك ايند القديم (NestJS/backend) إلى الباك ايند الجديد (Django/djangoo).

## المشكلة

عندما يرسل المستخدم النهائي طلب شحن لباقة (مثل PUBG Global 60)، كان الطلب يظهر في لوحة المستأجر بحالة "قيد المعالجة" (pending) وفي وضع يدوي (manual)، رغم أن:

1. الباقة مربوطة مع مزود خارجي (znet) في صفحة `/admin/products/integrations/`
2. تم تفعيل التوجيه التلقائي للباقة في صفحة `/admin/products/package-routing/`

**السبب**: لم يكن هناك منطق في djangoo لإرسال الطلب تلقائياً للمزود الخارجي بعد إنشائه.

## الحل

### 1. إنشاء دالة `try_auto_dispatch` في `apps/orders/services.py`

```python
def try_auto_dispatch(order_id: str, tenant_id: Optional[str] = None) -> None
```

**الوظيفة**:
- تفحص إعدادات `PackageRouting` للباقة
- إذا كان `mode=auto` و `providerType=external`، ترسل الطلب للمزود الخارجي
- تستخدم `PackageMapping` لمعرفة معرّف الباقة عند المزود
- ترسل الطلب عبر الـ adapter المناسب (znet, barakat, إلخ)
- تحدث حالة الطلب حسب نتيجة الإرسال

**الخطوات**:
1. جلب الطلب من قاعدة البيانات
2. التحقق من أن الطلب في حالة `pending` ولم يُرسل بعد
3. جلب إعدادات `PackageRouting` للباقة
4. التحقق من `mode=auto` و `providerType=external`
5. جلب `PackageMapping` لمعرفة `provider_package_id`
6. جلب معلومات `Integration` للمزود
7. إعداد الـ credentials والـ adapter
8. بناء الـ payload للإرسال
9. إرسال الطلب عبر `adapter.place_order()`
10. تحديث الطلب بـ:
    - `providerId`
    - `externalOrderId`
    - `externalStatus`
    - `sentAt`
    - `lastSyncAt`
    - `lastMessage`
    - `providerMessage`
    - `costCurrency` و `costAmount`
11. إضافة ملاحظة للطلب بنتيجة الإرسال

### 2. ربط الدالة مع `OrdersCreateView`

في `apps/orders/views.py`، بعد إنشاء الطلب مباشرةً:

```python
# محاولة التوجيه التلقائي للمزود الخارجي
from apps.orders.services import try_auto_dispatch
try:
    try_auto_dispatch(str(order.id), str(tenant_uuid))
except Exception as e:
    # لا نفشل الطلب إذا فشل التوجيه التلقائي
    logger.warning("Auto-dispatch failed for order", extra={
        "order_id": str(order.id),
        "error": str(e)
    })
```

**ملاحظة مهمة**: نستخدم `try-except` للتأكد من أن فشل التوجيه التلقائي لن يفشل إنشاء الطلب نفسه.

## كيفية الاستخدام

### 1. إعداد التكامل مع المزود

في `/admin/products/integrations/`:
- أنشئ integration جديد للمزود (مثل znet)
- أدخل بيانات الاتصال (kod, sifre, baseUrl)

### 2. ربط الباقة مع المزود

في صفحة تفاصيل الـ integration:
- اذهب إلى "Package Mappings"
- اربط الباقة المحلية مع باقة المزود الخارجي

### 3. تفعيل التوجيه التلقائي

في `/admin/products/package-routing/`:
- أنشئ routing rule للباقة
- اختر:
  - `mode = auto` (تلقائي)
  - `providerType = external` (مزود خارجي)
  - `primaryProviderId = <integration-id>`

### 4. اختبار

عندما يرسل المستخدم طلب شحن للباقة:
1. يتم إنشاء الطلب بحالة `pending`
2. يتم إرساله تلقائياً للمزود الخارجي
3. يتم تحديث الطلب بـ:
   - `providerId`: معرّف المزود
   - `externalOrderId`: رقم الطلب عند المزود
   - `externalStatus`: حالة الطلب (`sent`, `processing`, `completed`, `failed`)
   - `sentAt`: وقت الإرسال
   - ملاحظة في Notes تشرح نتيجة الإرسال

## السلوك المتوقع

### عند نجاح الإرسال
- `externalStatus = sent` أو `processing`
- `providerId` و `externalOrderId` محددان
- `sentAt` و `lastSyncAt` محدثان
- ملاحظة في Notes: `"Auto-dispatch → ext=sent, msg=..."`

### عند فشل الإرسال
- الطلب يبقى في حالة `pending`
- `providerId` و `externalOrderId` فارغان
- ملاحظة في Notes: `"Auto-dispatch failed: ..."`
- يمكن للأدمن إعادة المحاولة يدوياً لاحقاً

## الاختلافات مع الباك ايند القديم

### التشابهات
- نفس المنطق الأساسي
- نفس التحققات (mode, providerType, mapping)
- نفس هيكل الـ payload

### الاختلافات
- استخدام Django ORM بدلاً من TypeORM
- استخدام raw SQL للتحديثات (لأن models managed=False)
- Logging بطريقة Django
- معالجة الأخطاء بطريقة Python

## الملفات المعدلة

1. `djangoo/apps/orders/services.py`:
   - إضافة دالة `try_auto_dispatch()`

2. `djangoo/apps/orders/views.py`:
   - تعديل `OrdersCreateView.post()` لاستدعاء `try_auto_dispatch()`

## الاختبار

### اختبار يدوي
1. تأكد من إعداد integration مع znet
2. اربط باقة PUBG Global 60 مع باقة znet
3. فعّل auto-routing للباقة
4. أرسل طلب شحن من المستخدم النهائي
5. تحقق من:
   - الطلب في `/admin/orders/` له `providerId` و `externalOrderId`
   - الحالة `externalStatus = sent` أو `processing`
   - وجود ملاحظة في Notes

### Logs
راجع logs الخاصة بـ `apps.orders.services` لرؤية:
- `"Auto-dispatch: Sending order to provider"`
- `"Auto-dispatch: Order sent successfully"`
- `"Auto-dispatch: Failed to send order"` (في حالة الفشل)

## استكشاف الأخطاء

### الطلب لا يُرسل تلقائياً؟
1. تحقق من وجود `PackageRouting` للباقة: `mode=auto`, `providerType=external`
2. تحقق من وجود `PackageMapping` بين الباقة والمزود
3. تحقق من وجود `Integration` فعال للمزود
4. راجع الـ logs للأخطاء

### خطأ "No mapping found"
- تأكد من وجود mapping في `/admin/products/integrations/<id>/mappings`

### خطأ "Integration not found"
- تأكد من أن `primaryProviderId` في PackageRouting صحيح
- تأكد من أن Integration ضمن نفس المستأجر (tenant)

## المراجع

- Backend القديم: `backend/src/products/products.service.ts` → `tryAutoDispatch()`
- Adapters: `djangoo/apps/providers/adapters/`
- Models: `djangoo/apps/providers/models.py`

---

**تاريخ التطبيق**: 2025-01-10  
**الحالة**: ✅ مكتمل وجاهز للاختبار
