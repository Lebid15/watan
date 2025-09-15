# Translation Keys Mapping

This document maps original (legacy) hardcoded Arabic UI strings to their new i18n keys. It assists reviewers while migrating remaining pages.

## Conventions
- Domains (prefixes):
  - `login.*` – Authentication (login page)
  - `nav.*` – Navigation/header items
  - `lang.*` – Language selector labels
  - `wallet.*` – Wallet and balance pills
  - `errors.*` – Generic or cross‑domain error states (network, session, upload primitives, unexpected)
  - `auth.*` – Authorization / role based messages
  - `product.*` – Product entity page labels, states & actions
  - `package.*` – Package creation / validation messages
  - `unit.*` – Counter (unit) specific validation & save messages
  - `counter.*` – Explanatory/instructional text for counter mode
  - `generic.*` – Very short generic fallbacks used in alerts

Future suggestions (not yet created in code):
- `order.*`, `orders.*` – For orders list/details pages
- `user.*` – User profile / management
- `settings.*` – Settings sections
- `form.*` – Generic form validations (if generalized later)

---
## Mapping: Login
| Original Arabic | Key |
|-----------------|-----|
| "تسجيل الدخول" | `login.title` |
| "البريد الإلكتروني أو اسم المستخدم" | `login.identifier.label` |
| placeholder same | `login.identifier.placeholder` |
| "كلمة المرور" | `login.password.label` |
| "إظهار كلمة المرور" | `login.password.show` |
| "إخفاء كلمة المرور" | `login.password.hide` |
| "دخول" | `login.submit` |
| "نسيت كلمة المرور؟" | `login.forgot` |
| "التحقق من البريد" | `login.verifyEmail` |
| "لا تملك حساباً؟" | `login.noAccount` |
| "إنشاء حساب" | `login.register` |

## Mapping: Navigation / Language
| Arabic | Key |
|--------|-----|
| "الملف الشخصي" | `nav.profile` |
| "المفضلة" | `nav.favorites` |
| "الأمان" | `nav.security` |
| "تسجيل الخروج" | `nav.logout` |
| "العربية" | `lang.ar` |
| "English" | `lang.en` |
| "Türkçe" | `lang.tr` |

## Mapping: Common Errors / Auth
| Arabic | Key |
|--------|-----|
| "تعذر الاتصال بالخادم أثناء الرفع" | `errors.upload.network` |
| "جلسة منتهية، يرجى تسجيل الدخول" | `errors.session.expired` |
| "الصورة كبيرة جدًا" | `errors.image.tooLarge` |
| "إعدادات Cloudinary غير صحيحة" | `errors.cloudinary.badConfig` |
| "فشل رفع الملف…" | `errors.upload.generic` |
| "لم يتم استلام رابط الصورة" | `errors.image.missingUrl` |
| "فشل في جلب بيانات المنتج" | `errors.product.fetchFailed` |
| "حدث خطأ غير متوقع" | `errors.unexpected` / `generic.error` |
| "الرجاء تسجيل الدخول كمسؤول." | `auth.admin.loginRequired` |
| "خطأ" | `generic.error.short` |

## Mapping: Product Page
| Arabic | Key |
|--------|-----|
| "المنتج:" (label before name) | `product.pageTitle` (combined with name via template) |
| "اسم المنتج" | `product.field.name.placeholder` |
| "الوصف" | `product.field.description.placeholder` |
| "تم حفظ التغييرات بنجاح" | `product.save.success` |
| "فشل في تعديل المنتج" | `product.save.fail` |
| "فشل في حذف المنتج" | `product.delete.fail` |
| "هل أنت متأكد من حذف هذا المنتج؟" | `product.delete.confirm` |
| "هل أنت متأكد من حذف هذه الباقة؟" | `product.package.delete.confirm` |
| "المنتج غير موجود" | `product.notFound` |
| "لا توجد صورة" | `product.image.none` |
| "جاري التحميل..." | `product.status.loading` |
| "فشل تحديث نمط العداد" | `product.update.counterMode.fail` |
| "تعذر تحديث نمط العداد" | `product.update.counterMode.unable` |
| "تفعيل نمط العداد (الوحدة)" | `product.counter.enable.label` |
| "حفظ التغييرات" | `product.save.button` |
| "حذف المنتج" | `product.delete.button` |
| "فعال؟" | `product.active.label` |

## Mapping: Package / Unit / Counter
| Arabic | Key |
|--------|-----|
| "فشل في إضافة الباقة" | `package.add.fail` |
| "يرجى إدخال اسم الباقة" | `package.add.nameRequired` |
| "يرجى اختيار الجسر" | `package.add.bridgeRequired` |
| "فعّل نمط العداد أولاً ثم أضف باقة من نوع unit" | `package.add.counterFirst` |
| "اسم الوحدة مطلوب" | `unit.name.required` |
| "الحد الأقصى يجب أن يكون أكبر أو يساوي الحد الأدنى" | `unit.limit.rangeInvalid` |
| "Step يجب أن يكون > 0" | `unit.step.invalid` |
| "فشل الحفظ" | `unit.save.fail` |
| Long counter instructions paragraph | `counter.instructions.noUnitPackage` |

## Notes
- Trimming whitespace: placeholders purposely kept short & functional.
- Some original Arabic comments (developer notes) are intentionally not translated because they are not UI-facing.
- Reuse strategy: Prefer existing `errors.*` keys inside product page to avoid duplication.
- When adding orders page keys, follow the same structure: `orders.list.*`, `orders.detail.*`, `orders.status.*`, `orders.actions.*`, plus reuse `errors.*` where possible.

## Next Steps
1. Extract orders page strings into proposed `orders.*` keys.
2. Update this mapping with new sections.
3. (Optional) Split very large `common.json` into modular namespaces once stabilization is complete.

---
## Mapping: Orders Page (Admin)
| Arabic Original | Key |
|-----------------|-----|
| "إدارة الطلبات" | `orders.pageTitle` |
| "جاري التحميل…" | `orders.loading` |
| "بحث عام" | `orders.filters.search.label` |
| "اكتب رقم/مستخدم/باقة…" | `orders.filters.search.placeholder` |
| "الحالة" | `orders.filters.status.label` |
| "الكل" (status/method) | `orders.filters.status.all` / `orders.filters.method.all` |
| "قيد المراجعة" | `orders.filters.status.pending` / `orders.status.pending` |
| "مقبول" | `orders.filters.status.approved` / `orders.status.approved` |
| "مرفوض" | `orders.filters.status.rejected` / `orders.status.rejected` |
| "طريقة التنفيذ" | `orders.filters.method.label` |
| "يدوي (Manual)" | `orders.filters.method.manual` |
| "الأكواد الرقمية" | `orders.filters.method.internalCodes` |
| "من تاريخ" | `orders.filters.from` |
| "إلى تاريخ" | `orders.filters.to` |
| "تحديث" | `orders.filters.refresh` |
| "مسح الفلتر" | `orders.filters.clear` |
| "تمت إعادة التصفية" | `orders.filters.clearedToast` |
| "ملاحظة (اختياري)" | `orders.bulk.note.placeholder` |
| "حدد الجهة الخارجية…" | `orders.bulk.provider.placeholder` |
| "اختر الجهة الخارجية" | `orders.bulk.provider.selectTitle` |
| "إرسال" | `orders.bulk.dispatch.button` |
| "تحويل إلى يدوي" | `orders.bulk.manual.button` |
| "موافقة" | `orders.bulk.approve.button` |
| "رفض" | `orders.bulk.reject.button` |
| "لم يتم تحديد أي طلبات" | `orders.bulk.needSelection` |
| "يرجى اختيار الجهة الخارجية أولاً" | `orders.bulk.needProvider` |
| "تمت الموافقة على {count} طلب(ات) بنجاح" | `orders.bulk.approve.success` |
| "تعذر الموافقة" | `orders.bulk.approve.fail` |
| "تم رفض {count} طلب(ات)" | `orders.bulk.reject.success` |
| "تعذر الرفض" | `orders.bulk.reject.fail` |
| "تم إرسال {count} طلب(ات) بنجاح" | `orders.bulk.dispatch.partialSuccess` |
| "فشل توجيه بعض الطلبات" | `orders.bulk.dispatch.partialFail` |
| "تم إرسال الطلبات إلى الجهة الخارجية" | `orders.bulk.dispatch.successFallback` |
| "تعذر الإرسال للجهة الخارجية" | `orders.bulk.dispatch.fail` |
| "تم تحويل {count} طلب(ات) إلى Manual" | `orders.bulk.manual.success` |
| "تعذر تحويل الطلبات إلى Manual" | `orders.bulk.manual.fail` |
| "لوغو" | `orders.table.logo` |
| "رقم الطلب" | `orders.table.orderNo` |
| "المستخدم" | `orders.table.user` |
| "الباقة" | `orders.table.package` |
| "رقم اللاعب" | `orders.table.playerId` |
| "التكلفة" | `orders.table.cost` |
| "السعر" | `orders.table.price` |
| "الربح" | `orders.table.profit` |
| "الحالة" | `orders.table.status` |
| "الكمية:" | `orders.table.quantityPrefix` |
| "(مزود محذوف)" | `orders.table.externalProviderDeleted` / `generic.deletedProvider` |
| "كود" | `orders.table.internalCodes` |
| "Manual" | `orders.table.manualExecution` |
| "لا توجد طلبات مطابقة للفلاتر الحالية." | `orders.empty.filtered` |
| "تحميل المزيد" | `orders.loadMore` |
| "تفاصيل الطلب" | `orders.modal.title` |
| "تفاصيل الطلب #{number}" | `orders.modal.titleWithNumber` |
| "(الكمية: {count})" | `orders.modal.quantity` |
| "ملاحظة المزوّد" | `orders.modal.providerNote.title` |
| "تاريخ الوصول" | `orders.modal.arrivalAt` |
| "تاريخ الإنشاء" | `orders.modal.createdAt` |
| "قيمة الصرف مجمّدة" | `orders.modal.fxLocked` |
| "قيمة الصرف مجمّدة منذ {date}." | `orders.modal.fxLockedSince` |


---
_Last updated: (auto)_
