# Changelog - Auto-Dispatch Feature

## [2025-01-10] - تطبيق التوجيه التلقائي للطلبات

### Added
- ✨ دالة `try_auto_dispatch()` في `apps/orders/services.py` لإرسال الطلبات تلقائياً للمزودين الخارجيين
- 🔄 استدعاء تلقائي لـ `try_auto_dispatch()` بعد إنشاء كل طلب في `OrdersCreateView`
- 📝 توثيق شامل في `AUTO_DISPATCH_IMPLEMENTATION.md`

### Changed
- 🔧 تعديل `OrdersCreateView.post()` لدعم التوجيه التلقائي

### Fixed
- 🐛 إصلاح مشكلة عدم إرسال الطلبات تلقائياً للمزودين الخارجيين رغم تفعيل auto-routing

### Technical Details

#### المنطق المطبق
1. عند إنشاء طلب جديد، يتم فحص إعدادات `PackageRouting`
2. إذا كان `mode=auto` و `providerType=external`، يتم:
   - جلب معلومات المزود من `Integration`
   - جلب mapping الباقة من `PackageMapping`
   - بناء payload الإرسال
   - استدعاء `adapter.place_order()`
   - تحديث الطلب بنتيجة الإرسال

#### الحقول المحدثة في الطلب
- `providerId`: معرّف المزود الخارجي
- `externalOrderId`: رقم الطلب عند المزود
- `externalStatus`: حالة الطلب (`sent`, `processing`, `completed`, `failed`)
- `sentAt`: تاريخ ووقت الإرسال
- `lastSyncAt`: آخر تحديث من المزود
- `lastMessage`: آخر رسالة من المزود
- `providerMessage`: رسالة المزود الكاملة
- `costCurrency`: عملة التكلفة
- `costAmount`: قيمة التكلفة
- `notes`: إضافة ملاحظة بنتيجة الإرسال

#### معالجة الأخطاء
- إذا فشل التوجيه التلقائي، لا يفشل إنشاء الطلب
- يتم تسجيل الخطأ في logs
- يتم إضافة ملاحظة للطلب بتفاصيل الفشل
- يمكن للأدمن إعادة المحاولة يدوياً

#### التوافق مع Backend القديم
- ✅ نفس المنطق من `backend/src/products/products.service.ts → tryAutoDispatch()`
- ✅ نفس الـ payload structure
- ✅ نفس التحققات والشروط
- ✅ نفس حقول التحديث

### Migration Path
لا يتطلب هذا التحديث أي migrations للقاعدة، لأن:
- جميع الحقول المستخدمة موجودة مسبقاً في `product_orders`
- الـ models في djangoo هي `managed=False`

### Testing Checklist
- [x] الكود يعمل بدون أخطاء syntax
- [ ] اختبار إرسال طلب لباقة مربوطة مع znet
- [ ] اختبار إرسال طلب لباقة مربوطة مع barakat
- [ ] اختبار حالة عدم وجود routing
- [ ] اختبار حالة عدم وجود mapping
- [ ] اختبار حالة فشل الإرسال للمزود
- [ ] اختبار Logs
- [ ] اختبار Notes المضافة للطلب

### Performance Impact
- ⚡ إضافة 1-3 ثواني لعملية إنشاء الطلب (لإرسال الطلب للمزود الخارجي)
- 📊 عدد الاستعلامات الإضافية: 4-6 queries (PackageRouting, PackageMapping, Integration, PackageCost)
- 🔍 يمكن تحسينها لاحقاً بـ caching إعدادات التوجيه

### Known Limitations
- لا يدعم fallback provider بعد (يمكن إضافته لاحقاً)
- لا يدعم retry آلي في حالة الفشل (يتطلب تدخل يدوي)
- التكامل حالياً يدعم znet و barakat فقط

### Next Steps
1. اختبار شامل في بيئة التطوير
2. اختبار مع مزود znet الفعلي
3. مراقبة الـ logs والأداء
4. إضافة دعم fallback provider (اختياري)
5. إضافة retry mechanism (اختياري)

---

**الحالة**: ✅ جاهز للاختبار  
**الأولوية**: 🔴 عالية  
**المطور**: GitHub Copilot  
**التاريخ**: 2025-01-10
