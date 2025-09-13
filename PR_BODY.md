# Phase 3 — Unit Pricing (Admin + Storefront) + Testing/Docs

TL;DR: يضيف هذا الـ PR تسعير العداد (Unit) كاملًا: تفعيل/تعطيل، إعدادات باقات unit، Overrides لكل مجموعة أسعار، بطاقة شراء بالعداد في الواجهة، دقة أسعار ديناميكية (2–3 منازل)، اختبارات (13 خضراء)، وتوثيق (Admin / Storefront / Redirect / Troubleshooting). لا تغييرات كاسرة على الباقات الثابتة (fixed).

---
## Summary
تنفيذ دعم التسعير بالعداد (Unit Pricing) عبر Admin + Storefront بصورة متكاملة مع اختبارات ووثائق. يشمل:
- تفعيل/تعطيل العداد لكل منتج.
- إعدادات خاصة للباقات من نوع `unit` (اسم، رمز، حدود، خطوة، سعر أساسي).
- Unit Price Override لكل مجموعة أسعار (إنشاء/حذف + إعادة جلب).
- بطاقة شراء بالعداد في الواجهة العامة مع تحقق وسعر فوري.
- دعم دقة أسعار ديناميكية (2 أو 3 منازل عشرية).
- استخراج دالة `fetchUnitPrice()` قابلة للاختبار (fail-safe).
- تحديث README بالتفاصيل + سيناريوهات التعامل مع المشاكل.

---
## Admin Features
### Products List
- زر (Counter / Fixed) بتحديث تفاؤلي + Rollback عند الفشل + Toasts.
### Product Detail
- تبويب Unit settings يظهر عند تفعيل supportsCounter ووجود باقات type='unit'.
- الحقول: `unitName`, `unitCode`, `minUnits`, `maxUnits`, `step`, `baseUnitPrice`.
- احترام الدقة من `NEXT_PUBLIC_PRICE_DECIMALS`.
- تحقق مسبق قبل الحفظ.
### Price Groups
- عمود Unit price للباقات `unit` فقط.
- إنشاء Override: `PUT /api/admin/price-groups/:groupId/package-prices/:packageId/unit`.
- حذف Override: `DELETE /api/admin/price-groups/:groupId/package-prices/:packageId/unit`.
- إعادة جلب (بعد كل عملية) عبر:
  `GET /api/admin/products/price-groups/:groupId/package-prices?packageId=...`
- Badge “Overridden” عند وجود تخصيص.
- منع إدخال قيم غير صالحة (≤0 أو خارج الدقة).

---
## Storefront
### CounterPurchaseCard
يظهر فقط إذا:
1. `supportsCounter === true`
2. وجود باقة واحدة على الأقل `type === 'unit'` فعّالة

الوظائف:
- اختيار الباقة (إن تعددت).
- إدخال كمية مع تحقق (min / max / step / >0 / دقة / محاذاة خطوة).
- سعر فوري = (unitPrice × quantity) بتنسيق موحد.
- لا تُرسل أسعار من الواجهة؛ التسعير يُحسب نهائيًا في السيرفر.
- جلب override مرن يدعم:
  - `{ unitPrice: number }`
  - `{ data: [{ packageId, unitPrice }, ...] }`
  - الفشل ⇒ fallback إلى `baseUnitPrice`.
- إرسال: `POST /api/orders` → توجيه ذكي `/orders/{id}` أو `/orders`.
- رسائل فشل تعرض كما هي (مثل أكواد `ERR_*`).

---
## Utilities
| File | Purpose |
|------|---------|
| `src/utils/pricingFormat.ts` | `getDecimalDigits`, `formatPrice`, `priceInputStep`, `clampPriceDecimals` |
| `src/lib/pricing/fetchUnitPrice.ts` | `fetchUnitPrice()` تُعيد `number|null` (Fail-safe) ولا ترمي استثناءات |

خصائص `fetchUnitPrice()`:
- تدعم شكلين رئيسيين + fallback.
- قابلة للحقن بـ `fetchImpl` للاختبار.
- لا توقف الـ UI عند فشل الشبكة.

---
## Technical Highlights
- فصل منطق جلب سعر الوحدة في وحدة مستقلة (`fetchUnitPrice()`) تعيد `number|null` (لا throw).
- دقة ديناميكية عبر بيئة (2 أو 3) مع تكيّف step تلقائي.
- Tolerance عائم (1e-9) للتحقق من محاذاة الكمية مع step.
- واجهات resilient ضد تغيّرات مستقبلية في شكل الـ endpoint.
- عدم إرسال أي أسعار حساسة من العميل (أمان تسعيري).
- بنية قابلة للتوسع (Audit / Multi-group UI / Dashboards).

---
## Tests (13 Passed)
مزيج وحدة + تكامل يغطي:
1. UnitPriceOverrideCell (إنشاء/تحديث/حذف/rollback/دقة)
2. صفحة Price Groups (ظهور عمود، دعم digits=3، rollback)
3. CounterPurchaseCard (التحقق، نجاح/فشل، fallback)
4. fetchUnitPrice utility (direct, array, failure, null/base cases)

---
## Documentation Updates
في `frontend/README.md`:
- قسم Admin (التفعيل، إعدادات الوحدة، Overrides)
- قسم Storefront (شروط الظهور، الحساب الفوري، الإرسال، منع إرسال السعر)
- Redirect Behavior
- Troubleshooting (شكل الاستجابة، أخطاء الحدود/الخطوة، ظهور 0.00، تعدد الاستدعاءات، شروط الظهور، حالات fallback)

---
## Notes
- الدقة عبر: `PRICE_DECIMALS` / `NEXT_PUBLIC_PRICE_DECIMALS` (2 أو 3 منازل).
- حزم fixed غير متأثرة.
- الحساب النهائي للسعر في السيرفر.
- تصميم يمهّد لدعم مستويات تخصيص إضافية لاحقًا.

---
## Potential Phase 4 Ideas
| Idea | Value |
|------|-------|
| Multi-group overrides UI | مرونة تسعير أعلى |
| Audit trail | تتبع تغييرات حساسة |
| Dashboards استهلاك الوحدات | رؤية تشغيلية وتحليلية |

---
## Changelog
```
feat(admin): toggle supportsCounter في قائمة المنتجات
feat(admin): تبويب Unit settings (unitName/unitCode/min/max/step/baseUnitPrice)
feat(admin): CRUD على unit price override + Badge
feat(front): CounterPurchaseCard (تحقق + سعر فوري + توجيه)
refactor(front): استخراج fetchUnitPrice() + اختبارات
chore(docs): تحديث README (Admin/Storefront/Redirect/Troubleshooting)
test: 13 اختبارات (وحدة + تكامل) خضراء
```

---
## Checklist
- [x] Admin toggle
- [x] Unit settings + validation
- [x] Overrides CRUD + badge
- [x] Dynamic decimals
- [x] Storefront conditional card
- [x] Input validation + live total
- [x] Redirect logic
- [x] fetchUnitPrice util + tests
- [x] Docs updated
- [x] All tests green

---
## Ready for Review ✅
(لقطات شاشة يمكن إضافتها لاحقًا)
