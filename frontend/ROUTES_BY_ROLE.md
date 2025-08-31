## مصفوفة التوجيه النهائية حسب الأدوار

الوضع الحالي يطبّق القواعد التالية (بعد التوضيح النهائي):

الأدوار:
- developer (صاحب المنصة الكلي) على الـ domain الرئيسي فقط
- tenant_owner (صاحب المتجر الفرعي / المستأجر)
- distributor (موزع تابع للمتجر) تحت نفس الـ subdomain
- user (مستخدم واجهة المتجر) تحت نفس الـ subdomain

مصطلحات:
- Subdomain Tenant: مضيف يحتوي 3 أجزاء أو أكثر والجزء الأول ليس ضمن [www, app]
- Apex Platform: المضيف الجذري (مثال example.com أو app.example.com)

### الجذر '/'
| السياق | الدور | السلوك |
|--------|-------|--------|
| Apex | developer | redirect => /dev |
| Apex | غيره | يبقى في '/' (صفحة عامة) |
| Subdomain | tenant_owner | redirect => /admin |
| Subdomain | distributor | redirect => /admin/distributor |
| Subdomain | user | redirect => /app |
| Subdomain | developer | redirect => apex /dev (لا يسمح بالبقاء داخل متجر) |

### /admin
مسموح داخل Subdomain فقط.
- tenant_owner: كامل /admin
- distributor: فقط /admin/distributor (محاولة دخول قسم آخر => redirect /admin/distributor)
- user: redirect /app
- developer: redirect إلى apex /dev (ممنوع داخل لوحة متجر)
- على Apex: أي وصول إلى /admin ⇒ redirect '/'

### /dev
مسموح فقط لـ developer وعلى الـ Apex. أي Subdomain ⇒ redirect /admin (أو /admin للمالك /admin/distributor للموزع حسب الدور). أدوار غير developer على Apex ⇒ redirect '/'.

### /app
مسموح فقط على Subdomain. أدوار ممنوعة:
- developer ⇒ redirect apex /dev
مسموح للمستخدمين والمتجر (tenant_owner, distributor, user) لأغراض التصفح/المتجر.
على Apex: أي /app ⇒ redirect '/'.

### بدون تسجيل دخول
المسارات العامة: /login /register /password-reset /verify-email /nginx-healthz + '/'
أي مسار محمي آخر ⇒ redirect /login

### استخراج الدور وتطبيع الأسماء
instance_owner / owner ⇒ tenant_owner

### جدول مختصر
| الدور | Apex مسموح | Subdomain مسموح | Admin Scope | Dev Scope | App Scope |
|------|------------|-----------------|-------------|-----------|----------|
| developer | /dev | (ممنوع؛ يُعاد توجيهه خارجاً) | لا | نعم (Apex فقط) | لا |
| tenant_owner | Landing '/' عامة | /admin /app | /admin كامل | لا | نعم |
| distributor | Landing '/' عامة | /admin/distributor /app | /admin/distributor فقط | لا | نعم |
| user | Landing '/' عامة | /app | لا | لا | نعم |

### ملاحظات مستقبلية
- يفضل إضافة حارس (client guard) يكشف محاولات تنقل client-side غير مصرح بها لتجربة أوضح.
- إضافة اختبارات middleware لتغطية المصفوفة أعلاه.
