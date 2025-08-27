# 1) نظرة عامة
مشروع متعدد الطبقات لإدارة منتجات وباقات وأسعار وطلبات متعددة المستأجرين (Multi-Tenant). الخلفية NestJS (Express + TypeORM) مع PostgreSQL، الواجهة Next.js (App Router) مع React، الاعتماد على Docker و docker-compose للتشغيل (خدمات: backend, frontend, nginx, قاعدة بيانات). Nginx عاكس عكسي مع إعداد CORS ديناميكي لدومين syrz1.com وجميع الدومينات الفرعية، ودعم مسار /api عبر api.syrz1.com أو مسار نسبي داخل الدومينات الفرعية. المصادقة JWT مع كوكي HttpOnly (Domain=syrz1.com) وترويسة X-Tenant-Host لتحديد المستأجر.

# 2) الأدوار والصلاحيات (الوضع الحالي)
الأدوار المعرفة حاليًا في enum UserRole: developer, instance_owner (معلّمة deprecated في التعليق), distributor, user, admin. الجدول users يخزن role كسلسلة (varchar) بدون قيود enum في قاعدة البيانات. الأدوار المستعملة فعليًا في الحمايات (RolesGuard / @Roles):
- developer: وصول مميز (مثلاً dev/errors، مسارات عامة عليا بدون tenant). يسمح بالتحايل على شرط وجود tenant في بعض الحراس.
- instance_owner: مستخدم خاص قديم (مذكور في منطق السماح null tenant)؛ مُشار إليه في jwt.strategy للتحقق من السماح tenantId null. مُعلّق أنه متجه للإزالة.
- admin: صلاحيات إدارة المستأجر: /admin/** (products, orders, payment-methods, deposits, integrations, codes, settings, stats, upload, reports, tenants (مع developer)).
- user: المستخدم العادي للطلبات والرصيد.
- distributor: مُعرف لكن غير واضح استخدامه في الحمايات (لم يظهر في grep استعمال @Roles له) => غير واضح الاستخدام الحالي.
استعمال الأدوار في الكنترولرات:
- كل مسارات admin/* محمية بـ JwtAuthGuard + RolesGuard + @Roles(UserRole.ADMIN) (أحيانًا ADMIN, DEVELOPER في بعض الاستثناءات مثل tenants, user management جزئياً).
- dev/errors يتطلب developer فقط.
- بعض فلاتر tenant.guard تسمح developer و instance_owner بتجاوز غياب tenantId.
أدوار غير مستخدمة عمليًا: distributor (غير واضح من الكود الحالي أي كنترولر يستخدمه).

# 3) خريطة المسارات
Prefix عام للباك إند: /api (مفترض من Nest global prefix؛ مستنتج من الاستخدام في الواجهة). الكنترولرات (داخل /api):
- (جذر صحي) health.controller (بدون مسار صريح) و metrics (metrics/).
- auth: auth, auth/passkeys.
- users: users, user-price-groups, pages.
- products و المشتقات: products, orders (product-orders.controller), admin/orders (product-orders.admin.controller), price-groups, products/packages (package-prices.controller).
- admin/*: admin (جذر إداري عام), admin/catalog, admin/products, admin/providers, admin/settings, admin/stats, admin/upload, admin/reports, admin/payment-methods, admin/deposits, admin/integrations, admin/codes, admin/tenants.
- payments: payment-methods, deposits (+ نسخ admin لكل منهما)، notifications، currencies، codes (admin/codes فقط)، integrations (admin/integrations), dev/errors.
الفرونت إند (Next.js): مجلدات app/components/hooks/utils/types الخ. الصفحات الدقيقة لم تُفحص مفصلة؛ واضح وجود صفحات /login /admin /dev (استنتاج من إعادة توجيه interceptor وملف dev/subdomains). وجود صفحة dev/subdomains لعرض وإدارة الدومينات الفرعية وعرض كلمة مرور المالك المؤقتة.

# 4) نموذج البيانات (الجداول/الكيانات الأساسية)
- tenant: حقول (id, name, code فريد, ownerUserId nullable, isActive, createdAt, updatedAt) + علاقة OneToMany مع tenant_domain.
- tenant_domain: ربط الدومينات بالمستأجر (مذكور بالبحث، تفاصيل الحقول غير معروضة هنا).
- users: (id, tenantId nullable لبعض الأدوار العليا, adminId, email فريد داخل tenant, username فريد داخل tenant, password, balance decimal(12,2), role, phoneNumber, countryCode, nationalId, fullName, isActive, overdraftLimit decimal(12,2), price_group_id, currency_id, createdAt, updatedAt, emailVerified, emailVerifiedAt). فهارس فريدة مركبة tenantId+email و tenantId+username.
- currencies: (id, tenantId, code, name, rate decimal(10,4), isActive, isPrimary, symbolAr) فريد مركب tenantId+code.
- product: (id, tenantId, name فريد داخل tenant, description, catalogImageUrl, customImageUrl, catalogAltText, customAltText, thumbSmallUrl/Medium/Large, useCatalogImage boolean, isActive) علاقة OneToMany مع product_packages.
- product_packages: (id, tenantId, publicCode فريد مركب مع tenant, name, description, imageUrl, basePrice decimal(10,2), capital decimal(10,2), isActive, product_id) + فهارس tenantId+isActive و product_id. علاقة OneToMany إلى package_prices.
- package_prices: (id, tenantId, price decimal(10,2), package_id, price_group_id) فريد مركب (tenantId, package, priceGroup).
- price_groups: (id, tenantId, name فريد داخل tenant, isActive) علاقات مع package_prices و users.
- product_orders: (id, tenantId, orderNo int non-unique عالميًا مع فريد مركب tenantId+orderNo, product, package, quantity, sellPriceCurrency, sellPriceAmount decimal(10,2), price decimal(10,2), costCurrency, costAmount decimal(10,2), profitAmount decimal(10,2), status, user, userIdentifier, extraField, providerId, externalOrderId, externalStatus, attempts, lastMessage, manualNote, notes(jsonb / simple-json), pinCode, sentAt, lastSyncAt, completedAt, durationMs, fxUsdTryAtApproval numeric(12,6), sellTryAtApproval numeric(12,2), costTryAtApproval numeric(12,2), profitTryAtApproval numeric(12,2), profitUsdAtApproval numeric(12,2), approvedAt, approvedLocalDate, approvedLocalMonth, fxCapturedAt, fxSource, fxLocked bool, createdAt, providerMessage, notesCount). فهارس: idx_orders_tenant, uq_orders_tenant_order_no (مركب), idx_orders_order_no, idx_orders_created_at.
- package_costs / integration الجداول (package_costs, package_mappings, package_routing) مستخدمة في التكامل والتوجيه (مذكورة في الكنترولر الإداري للأوامر).
- assets, notifications, audit_logs, error_logs, auth_tokens, passkey_credentials, deposit, payment_method, site_settings, catalog_product, catalog_package, code_group, code_item (موجودة بالـ grep ككيانات).
القيود المهمة: فريد مركب على أغلب الكيانات المتعددة المستأجرين (tenant + code/name). أعمدة snapshot في الطلب: sellTryAtApproval, costTryAtApproval, profitTryAtApproval, profitUsdAtApproval, fxUsdTryAtApproval, approvedLocalDate/Month.

# 5) العملات والتسعير (الوضع الحالي)
إدارة العملات عبر كيان currencies لكل مستأجر مع rate (precision 10 scale 4) يمثل كم تساوي العملة مقابل الدولار (الوصف في التعليق). التحويل والـ rounding يظهر جزء منه في product-orders.admin.controller (حساب profitTRY عبر toFixed(2)). تجميد أسعار عند الاعتماد عبر أعمدة *_AtApproval (TRY و USD) و fxUsdTryAtApproval (precision 12 scale 6) لإضافة دقة تحويل أعلى لسعر الصرف وقت التجميد. الدقة ليست 3 منازل عشرية؛ الأسعار الأساسية للباقات والطلبات scale=2 لمعظم المبالغ المالية، وسعر الصرف rate scale=4، وfxUsdTryAtApproval scale=6. تخزين لقطة TRY و USD للربح/السعر/التكلفة موجود (sellTryAtApproval, costTryAtApproval, profitTryAtApproval, profitUsdAtApproval). العملة المعروضة للمستخدم النهائي تعتمد على sellPriceCurrency (افتراضي USD) وتحويل TRY يظهر في الواجهة الإدارية بالحساب.

# 6) الطلبات والتنفيذ والمزوّدون
إنشاء الطلب عبر product-orders.controller (لم يُعرض كاملًا هنا لكن البنية واضحة من الكيان). حساب السعر/الربح مخزن مباشرة (sellPriceAmount, costAmount, profitAmount) إضافة إلى لقطات التحويل عند الاعتماد. الحقول المحفوظة تشمل محاولات attempts ورسائل providerMessage و pinCode و notes. Idempotency غير واضحة (لا يوجد حقل مفتاح خارجي للـ idempotency token). سجل إرسال خارجي موجود عبر order_dispatch_logs (كيان). التوجيه للمزوّد يتم عبر كيانات package_routing, package_cost, package_mapping وتُستخدم داخل products/integrations الخدمات (استُدل من الاستيراد في ProductOrdersAdminController). fallback/retry يعتمد على attempts و externalStatus.

# 7) الكتالوج والربط
استيراد المنتجات المرجعية عبر catalog_product و catalog_package (موجودة ك Entities). إزالة التكرار عبر فريد tenantId+name (للمنتج) و tenantId+publicCode (للباقات). لا يظهر شرط ≥ 2 باقات في الكود المعروض (غير واضح). publicCode مخزن في product_packages (حقل publicCode فريد مركب) ويُستخدم ككود خارجي/تعريفي. الربط الخارجي للمزوّد يظهر عبر package_mapping و package_routing.

# 8) التكامل الخارجي
كيانات integrations, package_routing, package_mapping, package_costs موجودة. يوجد controller admin/integrations مع حماية ADMIN. تفاصيل المصادقة الخارجية أو مفاتيح API غير معروضة هنا. غير واضح وجود استدعاء API خارجي فعلي داخل الملفات المعروضة. لا يوجد وصف OAuth؛ يبدو تكامل داخلي مخصص. إذا كانت هناك اتصالات فعلية فليست واضحة من المقاطع الحالية.

# 9) CI/CD والهجرات والبيئات
لا يظهر ملف GitHub Actions في الشجرة المعروضة (غير واضح وجود CI). المهاجرات داخل backend/src/migrations بأسماء مختومة بطابع زمني (YYYYMMDDThhmm + وصف) مثل 20250821T2200-CreateTenants, 20250825T0300-EnsureUserColumnsBaseline. إدارة البيئة عبر docker-compose وملفات Dockerfile و nginx.conf. اختلافات البيئة: استخدام TEST_DB_SQLITE=true يغير أنواع أعمدة (jsonb→simple-json، timestamptz→datetime). لا توجد ملفات مميزة لـ staging مُحددة (غير واضح).

# 10) شجرة المشروع المختصرة
backend/src/
- auth/ (auth.controller, auth.service, jwt.strategy, roles.guard, user-role.enum, passkeys/)
- admin/ (catalog.admin.controller, products.admin.controller, providers.admin.controller, settings, stats, upload, reports, admin.controller)
- products/ (product.entity, product-package.entity, package-price.entity, price-group.entity, product-order.entity, order-dispatch-log.entity, product-orders.controller/admin.controller)
- currencies/ (currency.entity, currencies.controller)
- payments/ (payment-method.entity, deposit.entity, payment-methods.controller/admin.controller, deposits.controller/admin.controller)
- tenants/ (tenant.entity, tenant-domain.entity, tenants.admin.controller, tenant.guard, tenant-context.middleware)
- user/ (user.entity, user.controller, dto/)
- integrations/ (integration.entity, package-routing.entity, package-cost.entity, package-mapping.entity, integrations.controller/service)
- dev/ (errors.controller, error-log.entity)
- notifications/ (notification.entity, notifications.controller/service)
- audit/ (audit-log.entity)
- codes/ (code-group.entity, code-item.entity, codes.admin.controller)
- assets/, infrastructure/schema, health/ (health.controller, metrics.controller)
- migrations/ (... طوابع زمنية ...)
frontend/src/
- app/ (صفحات Next.js، منها dev/subdomains)
- components/, hooks/, utils/ (api.ts), context/, types/, styles/
nginx/nginx.conf, docker-compose.yml, docker-compose.dev.yml, README.md.

# 11) ملاحظات تقنية على الوضع الحالي
1. الاعتماد على role كسلسلة حرة في قاعدة البيانات بدون enum حقيقي قد يسمح بأدوار خاطئة.
2. وجود دور distributor غير مستخدم وظيفيًا (غامض). 
3. الدور instance_owner معلّق deprecated لكن ما زال مُستخدم في منطق السماح للـ tenantId=null.
4. الدقة المالية متفاوتة (scale=2,4,6) ما قد يُعقد التجميع والمقارنات.
5. عدم وجود حقل idempotency واضح للطلبات قد يؤدي لإنشاء مكرر عند إعادة الإرسال.
6. مزيج من jsonb و simple-json حسب البيئة قد يسبب فروقات سلوك بين الاختبار والإنتاج.
7. كثرة الحقول المجمّدة عند الاعتماد في الطلب تزيد التعقيد (خطر عدم تحديث بعض اللقطات عند تعديل لاحق).
8. الحماية تعتمد على RolesGuard لكن السماح المؤقت لكل الأدوار tenantId=null في jwt.strategy قد يفتح سطح وصول أوسع.
9. لا توجد مؤشرات واضحة على قيود فريدة تمنع أكثر من isPrimary=1 في currencies (لم يُعرض index جزئي).
10. تكامل المزودين غير موثق داخليًا في الكود المعروض (غير واضح مصدر الأسعار الفعلية أو آلية التحديث).

