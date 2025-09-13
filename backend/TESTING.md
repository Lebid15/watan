## Testing Guide — Useful Env Flags

هذا الدليل يوضح أهم الأعلام البيئية (Environment Flags) المستخدمة أثناء الاختبارات، مع أمثلة تشغيل سريعة لكلٍ من Bash و PowerShell. جميع الأعلام (ما لم يُذكر خلاف ذلك) آمنة ولا تغيّر سلوك الإنتاج؛ يتم تفعيل تأثيرها فقط عندما يكون `NODE_ENV=test`.

---
### Precision / Pricing

`PRICE_DECIMALS` (افتراضي: `2`): عدد الخانات العشرية للأسعار (مسموح: 2 أو 3 أو 4).

تم الانتقال من ثوابت ثابتة إلى دوال كسولة (Lazy Getters):

```ts
getPriceDecimals();
getScaleBigInt();
getScaleNumber();
```

للاختبارات غيّر الدقة عبر المساعد:

`setTestPriceDecimals(decimals)` من `test/utils/price-decimals.helpers.ts` (يتكفل بإعادة ضبط الكاش الداخلي).

أمثلة:

```bash
# Bash
PRICE_DECIMALS=3 npm test -- --runInBand
```

```powershell
# PowerShell
$env:PRICE_DECIMALS='3'; npm test -- --runInBand
```

---
### Quiet Logs (اختياري)

`TEST_VERBOSE_ORDERS` (افتراضي: `false`): يكتم لوجات إنشاء الطلبات أثناء الاختبارات. فعِّله عند الحاجة لتشخيص سلوك الطلبات.

أمثلة:

```bash
TEST_VERBOSE_ORDERS=true npm test -- --runInBand
```

```powershell
$env:TEST_VERBOSE_ORDERS='true'; npm test -- --runInBand
```

> أي `console.log` إضافي خاص بالطلبات يمكن لفّه بـ:
> ```ts
> if (process.env.TEST_VERBOSE_ORDERS === 'true') console.log(...);
> ```

---
### Schedulers / Cron في الاختبارات

`TEST_DISABLE_SCHEDULERS` (افتراضي: `true` في `jest.setup.ts`): يعطّل الـ Cron / Interval أثناء الاختبارات لتجنّب بقاء مؤشرات (open handles).

التطبيق يستخدم:

```ts
ScheduleModule.forRootDisabled();
```

عندما يكون `NODE_ENV=test` و `TEST_DISABLE_SCHEDULERS=true`.

---
### Client API Logging (SQLite Safety)

`TEST_SYNC_CLIENT_API_LOGS` (افتراضي: `1`): يجعل إدراج سجلات Client API متزامنًا لتفادي تحذيرات `SQLITE_MISUSE` مع SQLite داخل نفس العملية.

تذكير: نداء التنظيف بعد كل spec (قبل `app.close()` و `dataSource.destroy()`):

```ts
await flushClientApiLogs();
```

ضعه في `afterAll` حينما تُنشئ تطبيق Client API ضمن spec.

---
### Rate Limit & Passkeys (اختبارات فقط)

`TEST_DISABLE_RATE_LIMIT` (اختياري): عند ضبطه `true` يُعطّل rate limit في الاختبارات الحساسة للتوقيت.

`PASSKEYS_ENABLED` (افتراضي: `false`): يسمح بتشغيل (أو تخطّي) سيناريوهات passkeys e2e. فعّله لتجربة التدفق.

أمثلة:

```bash
TEST_DISABLE_RATE_LIMIT=true npm test -- admin/client-api.e2e-spec.ts
PASSKEYS_ENABLED=true npm test -- passkeys.e2e-spec.ts
```

```powershell
$env:TEST_DISABLE_RATE_LIMIT='true'; npm test -- admin/client-api.e2e-spec.ts
$env:PASSKEYS_ENABLED='true'; npm test -- passkeys.e2e-spec.ts
```

---
### Postgres-Only E2E (اختياري)

لتشغيل بعض الـ specs على Postgres بدل SQLite:

أضف:

`E2E_PG_ENABLED=true` و `DATABASE_URL` إلى قاعدة اختبار Postgres.

يوجد سكربت PowerShell: `scripts/e2e-pg.ps1` (يشغّل ويضبط التجاوز)، ويتخطّى `TEST_DB_SQLITE`.

بدون هذه المتغيرات سيُتخطّى الـ spec تلقائيًا.

أمثلة:

```bash
E2E_PG_ENABLED=true DATABASE_URL=postgres://watan:pass@127.0.0.1:54329/watan_test npm run e2e:pg
```

```powershell
$env:E2E_PG_ENABLED='true'; $env:DATABASE_URL='postgres://watan:pass@127.0.0.1:54329/watan_test'; npm run e2e:pg
```

---
### أنماط التشغيل الموصى بها

تشغيل صامت ومستقر لكل السويت:

```bash
npm test -- --runInBand
```

اكتشاف مقابض مفتوحة (عند الحاجة):

```bash
npm test -- --runInBand --detectOpenHandles
```

---
### ملاحظات

- لا توجد تغييرات على سلوك الإنتاج: جميع التعطيلات/التفعيل محكومة بأعلام بيئية عندما `NODE_ENV=test`.
- لا تُعدّل الدقة في منتصف نفس العملية الإنتاجية؛ التغيير الديناميكي مخصص للاختبارات فقط عبر `setTestPriceDecimals`.
- إن احتجت لوجات إضافية في أي نطاق، لفّ `console.log` بشرط: `TEST_VERBOSE_ORDERS==='true'`.

---
### ملخّص سريع (Cheat Sheet)

| الهدف | المتغير | القيمة الشائعة |
|-------|---------|----------------|
| دقة الأسعار | PRICE_DECIMALS | 2 / 3 / 4 |
| كتم لوج الطلبات | TEST_VERBOSE_ORDERS | false (أو true للتشخيص) |
| تعطيل المجدولات | TEST_DISABLE_SCHEDULERS | true |
| مزامنة لوجات Client API | TEST_SYNC_CLIENT_API_LOGS | 1 |
| تعطيل Rate Limit | TEST_DISABLE_RATE_LIMIT | true (عند الحاجة) |
| تشغيل Passkeys | PASSKEYS_ENABLED | true (اختبارات) |
| تفعيل Postgres E2E | E2E_PG_ENABLED + DATABASE_URL | true + URL |

---
تم آخر تحديث: 2025-09-14.
