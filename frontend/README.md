This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Backend dependency

> **New:** the frontend now talks to the Django sidecar that lives in `djangoo/` under the prefix `/api-dj/**`.

1. داخل مجلد `djangoo/` فعّل البيئة وشغّل الخادم:
	```powershell
	cd ..\djangoo
	python -m venv .venv
	.\.venv\Scripts\Activate.ps1
	pip install -r requirements.txt
	python manage.py migrate
	python manage.py runserver 0.0.0.0:8000
	```
2. تأكد من أن المتغير `NEXT_PUBLIC_API_URL` (أو الافتراضي الجديد) يشير إلى `http://127.0.0.1:8000/api-dj`.
	- للإبقاء على الباك إند القديم (NestJS) يمكنك ضبط `NEXT_PUBLIC_USE_OLD_BACKEND=true` في `.env.local`.

بعد تشغيل الـ backend يمكن بدء خادم Next.js:
First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:


You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Unit Pricing (Admin UI)

هذه الواجهة تتيح تسعير المنتجات بوضع "عداد" (وحدات) بالإضافة إلى التسعير الثابت.

1. التفعيل: من صفحة `Admin > Products` استخدم زر التحويل (Counter / Fixed) لكل منتج.
2. إعدادات الوحدة: داخل صفحة المنتج يظهر تبويب "إعدادات العداد" عندما يكون المنتج مفعّلًا وبه باقات نوعها `unit`.
	- الحقول: `unitName`, `unitCode`, `minUnits`, `maxUnits`, `step`.
3. سعر الوحدة لكل مجموعة أسعار: في صفحة `Admin > Products > Price Groups` يظهر عمود "Unit price" للباقات ذات النوع `unit` فقط.
	- إدخال قيمة موجبة بعدد المنازل العشرية المعتمد (`NEXT_PUBLIC_PRICE_DECIMALS`).
	- حفظ (✓) ينشئ Override عبر: `PUT /api/admin/price-groups/:groupId/package-prices/:packageId/unit`.
	- حذف (×) يعيد القيمة الأساسية عبر: `DELETE /api/admin/price-groups/:groupId/package-prices/:packageId/unit`.
	- يتم جلب الحالة الحالية بعد كل عملية: `GET /api/admin/products/price-groups/:groupId/package-prices?packageId=...`.
4. الدقة (Precision): تحدد من المتغير `NEXT_PUBLIC_PRICE_DECIMALS` (افتراضي 2، ويمكن ضبطه لـ 3). جميع الحقول تحترم هذه الدقة (step ديناميكي 0.01 أو 0.001).
5. الباقات ذات النوع `fixed` تعرض شرطة (—) في عمود Unit price ولا تتأثر.
6. رسائل التوفير: نجاح الحفظ "تم حفظ سعر الوحدة."، حذف التخصيص "تم حذف التخصيص."، وفي الفشل تُعرض رسالة السيرفر.

معايير القبول (مختصرة):
- إنشاء وحذف الـ override ينعكسان فورًا بعد جلب التحديث.
- التحقق يمنع القيم غير الصالحة (≤0 أو صيغة خاطئة) قبل الإرسال.
- لا تأثير على الباقات الثابتة.

### شراء بالعداد (Storefront)

تظهر بطاقة "الشراء بالعداد" في صفحة المنتج (`/product/[id]`) فقط إذا:
1. المنتج مفعّل له `supportsCounter`.
2. توجد على الأقل باقة واحدة نوعها `unit` ومفعّلة.

المكوّن يعرض:
- اختيار الباقة (إن وُجد أكثر من باقة وحدات).
- حقل الكمية مع قيود: الحد الأدنى `minUnits`، الحد الأقصى `maxUnits`، والخطوة `step` (أو مستنتجة من `NEXT_PUBLIC_PRICE_DECIMALS`).
- السعر الفوري: (سعر الوحدة الفعّال × الكمية) يُحدَّث مباشرة ويستخدم الدقة المعتمدة.

مصدر سعر الوحدة الفعّال:
1. محاولة جلب سعر المجموعة (override) عبر endpoint مرن يقبل عدة أشكال:
	- `{ price: number }` أو `{ unitPrice: number }`
	- مصفوفة: `[ { packageId, price }, ... ]`
	- كائن: `{ data: [ { packageId, price }, ... ] }`
2. عند الفشل أو عدم العثور على صف للسعر يتم إرجاع `null` ويُعرض "—" في الواجهة، ولا يوجد Fallback.

التحقق (Client Side):
- يمنع: قيمة فارغة، غير رقمية، ≤ 0، أقل من الحد الأدنى، أكبر من الحد الأقصى، أو لا تطابق خطوة الزيادة (مع تسامح عائم صغير 1e-9).
- في حال الخطأ: يظهر نص تحذير ويُعطَّل زر الشراء.

الإرسال:
- `POST /api/orders` مع: `{ productId, packageId, quantity }` فقط (لا نرسل سعر الوحدة لتجنّب التلاعب، التقييم النهائي لدى الخادم).
- نجاح: Toast + تفريغ حقل الكمية + إعادة توجيه إلى `/orders/:id` إن توفر `id` أو `/orders`.
- فشل: عرض رسالة السيرفر كما جاءت (مثلاً أكواد `ERR_*`).

ملاحظات:
- دقة الأسعار تتحكم بها `NEXT_PUBLIC_PRICE_DECIMALS` (مثلاً 2 → step = 0.01، 3 → 0.001) إذا لم تقدّم الباقة خطوة صريحة.
- الحساب المعروض إرشادي؛ التسعير الحاسم يُحسب في الخلفية.

#### Redirect Behavior

عند نجاح الطلب:
- إذا احتوى الرد على `order.id` ⇒ الانتقال إلى `/orders/{id}`.
- إن لم يُوفّر `id` ⇒ الانتقال إلى `/orders`.

لضبط سلوك مخصص (فتح Modal، أو إبقاء المستخدم بالصفحة): لفّ استدعاء `POST /api/orders` ضمن دالة خارجية ومرر `onSuccess / onError` كـ Props للمكوّن بدل الاعتماد على التوجيه المدمج.

#### Troubleshooting

1. تغيّر شكل ردّ سعر الوحدة:
	- الكارت يدعم الصيغ: `{ price }`، `{ unitPrice }`، مصفوفة مباشرة، أو `{ data: [...] }`.
	- الفشل أو عدم وجود صف ⇒ النتيجة `null` (عرض شرطة) بدون أي Fallback.
	- لتعديل السلوك عدّل فقط دالة الجلب `fetchUnitPrice`.

2. أخطاء "STEP / MIN / MAX" من السيرفر:
	- تأكد أن الإدخال يطابق `step` والدقة (`NEXT_PUBLIC_PRICE_DECIMALS`).
	- اعرض رسالة السيرفر كما هي لتجنّب اختلاف الترجمة أو التضليل.

3. السعر يظهر —:
	- تحقّق من: تفعيل `supportsCounter`، الباقة نوعها `unit`، ووجود صف سعر للمجموعة في قاعدة البيانات.

4. استدعاءان متتاليان لـ fetch:
	- متوقع: الأول لجلب سعر الوحدة (override)، الثاني لإنشاء الطلب.
	- يمكن دمجه لاحقًا إذا وُفر Endpoint موحّد.

5. البطاقة لا تظهر:
	- الشرطان: `supportsCounter === true` ووجود باقة واحدة على الأقل `type === 'unit'` مفعّلة.

6. فشل مفاجئ بعد نجاح التحقق المحلي:
	- التقييم النهائي (السعر، الحدود) يُعاد التحقق منه في السيرفر؛ راجع رسالة الخطأ المعادة وابحث عن تحديثات حصلت في `minUnits`/`maxUnits` أثناء تفاعل المستخدم.


## 🌐 تعدد اللغات (Arabic / English / Turkish)

تم إضافة دعم تعدد اللغات عبر تحميل ديناميكي لملفات JSON من `public/locales`.

### اللغات المدعومة
| Code | اللغة |
|------|-------|
| ar   | العربية (افتراضي) |
| en   | English |
| tr   | Türkçe |

### أين توجد ملفات الترجمة؟
```
public/locales/
	ar/common.json
	en/common.json
	tr/common.json
```
نستخدم حاليًا مساحة أسماء واحدة: `common`.

### إضافة مفتاح ترجمة جديد
1. أضف المفتاح إلى `ar/common.json` (مصدر الحقيقة الأولي).
2. انسخ نفس المفتاح إلى `en/common.json` و `tr/common.json` مع القيم المترجمة.
3. استخدمه في الكود عبر:
```tsx
import i18n from '@/i18n/client';
const t = (k: string) => (i18n.getResource(i18n.language || 'ar', 'common', k) as string) || k;
...
<span>{t('some.key')}</span>
```

### مبدل اللغة
المكوّن: `src/components/LanguageSwitcher.tsx`
يُعرض في:
- الهيدر الرئيسي (`MainHeader`)
- صفحات بدون هيدر (مثل تسجيل الدخول) في أعلى يمين الصفحة.

### كيف يتم تحديد اللغة عند التحميل؟
1. Cookie باسم `NEXT_LOCALE` إن وُجد.
2. ثم `localStorage.locale`.
3. وإلا fallback إلى `ar`.

يتم ضبط:
- `document.documentElement.lang`
- `document.documentElement.dir` (قيمة `rtl` فقط للـ `ar`).

### التبديل بين اللغات
ينفذ:
- `setLocale(code)` في `src/i18n/client.ts`:
	- تغيير لغة i18next.
	- تخزين في LocalStorage + Cookie.
	- تحديث الخصائص `lang` و `dir`.

### إضافة لغة جديدة (مثال: الألمانية de)
1. أنشئ مجلد: `public/locales/de`.
2. انسخ `ar/common.json` إلى `de/common.json` وترجم المحتوى.
3. عدّل مصفوفة `supportedLngs` في `src/i18n/client.ts`.
4. أضف الكود إلى مصفوفة `langs` داخل `LanguageSwitcher`.
5. (اختياري) اجعلها الافتراضية بتغيير `lng` و `fallbackLng`.

### ملاحظات تقنية
- لا نستخدم حاليًا `next-i18next` الكامل لعدم الحاجة إلى ترجمة على مستوى الخادم SSR لكل صفحة.
- التحميل ديناميكي (lazy)؛ أول عرض قد يظهر مفاتيح خام حتى يتم جلب الملف (عادةً سريع جدًا داخل نفس origin).
- يمكن لاحقًا التوسع لدعم namespaces متعددة (مثلاً `auth`, `cart`).

### اعتبارات RTL
- يتم تطبيق `dir=rtl` عالميًا فقط عند اللغة العربية.
- تأكد أن المكونات المرنة Flex لا تعتمد على `ml-*` بدون مراعاة الاتجاه عند إضافة لغات LTR.

### مشاكل شائعة
| المشكلة | السبب | الحل |
|---------|-------|------|
| يظهر المفتاح نفسه بدل الترجمة | لم يُحمّل الملف بعد | تأكد من استدعاء `loadNamespace` أو انتظر دورة إعادة الرسم |
| الاتجاه لم يتغير | عنصر `<html>` لم يُحدّث | يحدث عند التبديل قبل تهيئة i18n؛ أعد المحاولة بعد ثوان | 
| لغة تعود للعربية بعد تحديث الصفحة | Cookie / LocalStorage محجوبة | فعّل التخزين أو استخدم متصفح مختلف |

### اختبار سريع
1. افتح `/login`.
2. بدّل اللغة من الزاوية العلوية.
3. تأكد من ترجمة:
	 - العنوان
	 - لابل البريد
	 - زر الدخول
4. أعد التحميل (Refresh) وتحقق من بقاء اللغة المختارة.


