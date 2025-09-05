# Tenant Integrity & Zero-Issue Gate

قبل أي نشر (Deployment) يجب أن تكون حالة نزاهة الـ Tenants صفرية (Zero Issues).

الأداة:

```
npm run tenant:verify
```
(تشغيلها داخل مجلد `backend`.)

ما الذي تتحقق منه؟
- مستخدمين يشيرون إلى `tenantId` غير موجود.
- مستأجر بدون نطاق أساسي (primary domain).
- أكثر من نطاق أساسي واحد لنفس المستأجر.
- مستأجر بلا أي نطاقات.

سيُطبع JSON فيه `issues` وعدّادات. لو وُجدت أي مشكلة تخرج الأداة بكود 1 ويُمنع النشر.

## سياسة العلاقات (Deletion Policy)
- users.tenantId: عند حذف الـ Tenant يتم `SET NULL` (لا نحذف المستخدم لأغراض التدقيق).
- tenant_domain.tenantId: `CASCADE` لحذف النطاقات مع المستأجر.

## الهدف
إزالة حالات الـ orphan JWT ومنع أي `tenantId` غير مُسجل عبر مسار provisioning الرسمي.

## المسار الرسمي لإنشاء مستأجر
POST /admin/tenants/provision (يستلزم صلاحيات مناسبة)

Body (مثال):
```json
{
  "name": "Store 1",
  "code": "store1",
  "host": "store1.syrz1.com",
  "ownerUserId": "<optional-user-id>"
}
```

يرجى عدم إنشاء سجلات Tenant يدويًا.
