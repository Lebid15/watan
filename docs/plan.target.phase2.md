# Phase 2 — الكتالوج المُنتقى والربط (ملف مبدئي)

هذا الملف سيُستكمل مع التقدم. يحتوي الآن على عناوين placeholder.

## 1. الكتالوج المُنتقى
TODO

## 2. تفعيل المنتج للمتجر
TODO

## 3. الباقات وربط linkCode
TODO

## 4. تسعير الموزّع
TODO

## 5. الطلبات placedByDistributorId
TODO

## 6. اللقطات والتجميد
TODO

#### لقطات الموزّع (Phase 3 prelude)
تمت إضافة حقول لقطات خاصة بالموزّع للحفاظ على استقرار العرض:
- distributorCapitalUsdAtOrder / distributorSellUsdAtOrder / distributorProfitUsdAtOrder (DECIMAL 18,6) القيم الإجمالية بعد ضرب الكمية.
- fxUsdToDistAtOrder (DECIMAL 18,6) معدل تحويل USD→عملة الموزّع وقت إنشاء الطلب.
- distCurrencyCodeAtOrder (VARCHAR(10)) عملة الموزّع وقت إنشاء الطلب.
يتم استخدامها لإظهار الحقول المحوّلة Dist3 (capitalDist3 / sellDist3 / profitDist3) دون تأثر بتغيّرات لاحقة في أسعار الصرف أو تغيير تفضيل العملة للموزّع.

## 7. المخطط (ERD مختصر)
TODO

## 8. المهاجرات
TODO

## 9. معايير القبول
TODO

---

### Progress Checklist (temp)
- [x] Added catalog_product.isPublishable field (entity) – migration TBD
- [x] Added catalog_package.linkCode + nameDefault + partial unique index migration (20250827T1400)
- [ ] Enforce service-level validation for linkCode uniqueness & format
- [ ] Add product.catalogProductId field + staged migration sequence
- [ ] Add product_package.catalogLinkCode + createdByDistributorId fields + migrations
- [ ] Add orders.placedByDistributorId field + migration
- [ ] Implement /admin/catalog/publish endpoint (sets isPublishable TRUE with rules)
- [ ] Implement /tenant/catalog/activate-product endpoint
- [ ] Implement distributor pricing tables & CRUD APIs
- [ ] Update docs & ERD diagram

هذا القسم سيتم نقله وتنظيمه في أقسامه أعلاه لاحقاً.
