# إصلاح ترتيب الباقات ✅

## المشكلة

الباقات لم تُرتب بشكل صحيح! كانت تظهر:
```
120 → 180 → 325 → 60 → 660  ❌ (ترتيب خاطئ)
```

## السبب

في `AdminIntegrationPackagesView`، كان الترتيب:
```python
our_packages = list(qs.order_by('product__name', 'name'))
```

هذا يرتب حسب:
1. اسم المنتج أبجدياً
2. اسم الباقة أبجدياً

النتيجة: الباقات تُرتب حسب الأحرف:
- "pubg global **1**20" يأتي قبل "pubg global **6**0" لأن "1" < "6" أبجدياً!

## الحل

تم تعديل الترتيب إلى:
```python
our_packages = list(qs.order_by('product__name', 'base_price', 'name'))
```

الآن يُرتب حسب:
1. اسم المنتج
2. **السعر** (من الأرخص للأغلى)
3. اسم الباقة (كـ fallback)

## النتيجة المتوقعة

```
✅ pubg global 60  - USD 1.00  (الأرخص)
✅ pubg global 120 - USD 2.10
✅ pubg global 180 - USD 3.10
✅ pubg global 325 - USD 4.10
✅ pubg global 660 - USD 8.00  (الأغلى)
```

## الملف المعدل

**djangoo/apps/providers/views.py** - السطر 806:
```python
# قبل
order_by('product__name', 'name')

# بعد
order_by('product__name', 'base_price', 'name')
```

## ملاحظات

### للباقات في قائمة "باقة المزود"
تم أيضاً ترتيبها في السطر 851:
```python
provider_options.sort(key=lambda x: x.get('price', 0))
```

### المجموع
الآن كل من:
- ✅ صفوف الجدول (our_packages)
- ✅ خيارات المزود (provider_options)

**كلاهما مُرتب من الأرخص للأغلى!** 🎯

---

**التاريخ**: 14 أكتوبر 2025  
**الحالة**: ✅ تم الإصلاح
