// backend/src/main.ts
// ✅ حمّل .env.local أولاً إن وجد، وإلا .env
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

(() => {
  const root = process.cwd(); // مجلد backend عند التشغيل
  const envLocal = path.resolve(root, '.env.local');
  const env = path.resolve(root, '.env');

  if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal });
    console.log('🟢 Loaded env from .env.local');
  } else {
    dotenv.config({ path: env });
    console.log('🟡 Loaded env from .env');
  }
})();

import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { User } from './user/user.entity';
import { SchemaGuardService } from './infrastructure/schema/schema-guard.service';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Lightweight conditional request logging (diagnostics for missing /auth/login)
  if ((process.env.REQUEST_LOGGING || '0') === '1') {
    app.use((req: any, res: any, next: any) => {
      const start = Date.now();
      const host = req.headers['host'];
      res.on('finish', () => {
        console.log('[REQ]', req.method, req.originalUrl, 'host=', host, 'status=', res.statusCode, 'ms=', Date.now() - start);
      });
      next();
    });
    console.log('🟢 REQUEST_LOGGING enabled');
  }
  // Debug presence of developer bootstrap secret (length only) - remove later
  if (process.env.BOOTSTRAP_DEV_SECRET) {
    console.log('[DEBUG] BOOTSTRAP_DEV_SECRET detected (length=%d)', process.env.BOOTSTRAP_DEV_SECRET.length);
  } else {
    console.log('[DEBUG] BOOTSTRAP_DEV_SECRET NOT set');
  }
  // List all BOOTSTRAP* env var names for diagnostics (لا تطبع القيم السرية)
  try {
    const bootstrapKeys = Object.keys(process.env).filter(k => k.startsWith('BOOTSTRAP'));
    console.log('[DEBUG] BOOTSTRAP* keys =', bootstrapKeys);
  } catch {}

  // ✅ تعيين البادئة /api لكل REST ما عدا ملف OpenAPI العام للعميل كي يعمل أيضاً بدون البادئة
  // هذا يسمح بالوصول عبر:
  //   /api/client/api/openapi.json  (النمط الأصلي)
  //   /client/api/openapi.json      (بدون البادئة – بعد هذا التغيير)
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'client/api/openapi.json', method: RequestMethod.GET }],
  });

  // ✅ تفعيل CORS مع دالة ديناميكية للسماح بجميع الساب دومينات لـ wtn4.com + الجذر
  // يسمح لاحقاً بإضافة نطاقات تطوير (localhost) لو لزم
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // requests like curl or same-origin
      const allowed = /^(https?):\/\/([a-z0-9-]+)\.wtn4\.com$/i.test(origin) || /^(https?):\/\/wtn4\.com$/i.test(origin);
      if (allowed) return callback(null, true);
      return callback(new Error('CORS: Origin not allowed'), false);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,X-Tenant-Host,X-Requested-With,Accept,Origin',
    exposedHeaders: 'Content-Disposition'
  });

  // 🔁 دعم الوصول إلى مسارات Client API بدون البادئة /api عبر الدومين المركزي
  // مثال: GET https://api.syrz1.com/client/api/profile (يُعاد كتابته داخليًا إلى /api/client/api/profile)
  app.use((req: any, _res: any, next: any) => {
    // نتجنب إعادة الكتابة لو طلب OpenAPI العام (مستثنى أصلاً) أو لو المسار مُعاد بالفعل
    if (req.url.startsWith('/client/api/') &&
        !req.url.includes('openapi.json') &&
        !req.url.startsWith('/api/client/api/')) {
      req.url = '/api' + req.url; // يطابق المسار الحالي المسجّل بواسطة الـ Controller
    }
    next();
  });

  // 📌 ثبت reqId مبكرًا لكل طلبات Client API وأعده في الهيدر x-req-id حتى عند وقوع الاستثناء قبل الوصول للـ Controller
  app.use((req: any, res: any, next: any) => {
    try {
      const p: string = req.url || '';
      if ((p.startsWith('/api/client/api/') || p.startsWith('/client/api/')) && !p.includes('openapi.json')) {
        const incoming = (req.headers && (req.headers['x-request-id'] as string)) || '';
        const reqId = incoming || Math.random().toString(36).slice(2, 10);
        req.reqId = reqId;
        try { res.setHeader('x-req-id', reqId); } catch {}
      }
    } catch {}
    next();
  });

  // ✅ تفعيل cookie-parser لقراءة التوكن من الكوكي عند اللزوم
  app.use(cookieParser());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Watan API')
    .setDescription('API documentation for Watan project')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  // Export client API subset
  try {
    const clientPaths: Record<string, any> = {};
    for (const [p, schema] of Object.entries(document.paths || {})) {
      if (p.startsWith('/client/api/')) {
        clientPaths[p] = schema; // already without global prefix
      } else if (p.startsWith('/api/client/api/')) {
        // strip global prefix for public subset to keep nice paths
        const noPrefix = p.replace(/^\/api/, '');
        clientPaths[noPrefix] = schema;
      }
    }
  const subset = { ...document, paths: clientPaths, tags: [{ name: 'Client API' }], servers: [{ url: '' }] };
  const outDir = path.join(process.cwd(), 'openapi');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'openapi-client.json'), JSON.stringify(subset, null, 2), 'utf8');
  // Internal full spec (includes /api/users/* etc.)
  fs.writeFileSync(path.join(outDir, 'openapi-internal.json'), JSON.stringify(document, null, 2), 'utf8');
  console.log('📄 Generated openapi/openapi-client.json (paths=%d) & openapi-internal.json (full paths=%d)', Object.keys(clientPaths).length, Object.keys(document.paths||{}).length);
  } catch (e) {
    console.warn('Failed to generate client OpenAPI subset', e?.message);
  }

  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || '0.0.0.0';

  // ✅ احصل على DataSource قبل الاستماع لتطبيق الهجرات (مهم للإنتاج)
  const dataSource = app.get(DataSource);
  const autoMigrations = (process.env.AUTO_MIGRATIONS ?? 'true').toLowerCase() !== 'false';
  // Ensure pgcrypto extension for gen_random_uuid() defaults (Postgres)
  try {
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    console.log('🧩 pgcrypto extension ensured');
  } catch (e:any) {
    console.warn('pgcrypto extension not created (continuing):', e?.message);
  }

  // 🚚 (Moved Earlier) Run migrations BEFORE any preflight ALTER statements that assume tables exist
  if (autoMigrations) {
    try {
      const ran = await dataSource.runMigrations();
      if (ran.length) {
        console.log(`✅ Ran ${ran.length} migration(s) early:`, ran.map(m => m.name));
      } else {
        console.log('ℹ️ No pending migrations (early run)');
      }
    } catch (err: any) {
      console.error('❌ Failed to run migrations automatically (early):', err?.message || err);
    }
  } else {
    console.log('⏭ Skipping auto migrations (AUTO_MIGRATIONS=false)');
  }
  // --- Preflight structural patch: أضف أعمدة tenantId المفقودة قبل أي استعلامات تعتمدها ---
  try {
    console.log('🧪 [Preflight] Checking tenantId columns existence...');
    await dataSource.query(`
      DO $$
      BEGIN
        -- ====== Core tenant tables (create if missing) ======
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name='tenant'
        ) THEN
          CREATE TABLE "tenant" (
            "id" uuid PRIMARY KEY,
            "name" varchar(120) NOT NULL,
            "code" varchar(40) NOT NULL,
            "ownerUserId" uuid NULL,
            "isActive" boolean NOT NULL DEFAULT true,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
          );
          CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_code_unique" ON "tenant" ("code");
          CREATE INDEX IF NOT EXISTS "idx_tenant_name" ON "tenant" ("name");
          RAISE NOTICE 'Created table tenant';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name='tenant_domain'
        ) THEN
          CREATE TABLE "tenant_domain" (
            "id" uuid PRIMARY KEY,
            "tenantId" uuid NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
            "domain" varchar(190) NOT NULL,
            "type" varchar(20) NOT NULL DEFAULT 'subdomain',
            "isPrimary" boolean NOT NULL DEFAULT false,
            "isVerified" boolean NOT NULL DEFAULT false,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
          );
          CREATE UNIQUE INDEX IF NOT EXISTS "ux_tenant_domain_domain" ON "tenant_domain" ("domain");
          RAISE NOTICE 'Created table tenant_domain';
        END IF;
        -- users.tenantId (guard table existence)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users') THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenantId'
          ) THEN
            ALTER TABLE "users" ADD COLUMN "tenantId" uuid NULL;
            RAISE NOTICE 'Added users.tenantId';
          END IF;
        END IF;
        -- product_orders.tenantId
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product_orders') THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name='product_orders' AND column_name='tenantId'
          ) THEN
            ALTER TABLE "product_orders" ADD COLUMN "tenantId" uuid NULL;
            RAISE NOTICE 'Added product_orders.tenantId';
          END IF;
        END IF;
        -- product.tenantId (جدول المنتجات)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product') THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='tenantId'
          ) THEN
            ALTER TABLE "product" ADD COLUMN "tenantId" uuid NULL;
            RAISE NOTICE 'Added product.tenantId';
          END IF;
        END IF;
        -- product_packages.tenantId
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product_packages') THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name='product_packages' AND column_name='tenantId'
          ) THEN
            ALTER TABLE "product_packages" ADD COLUMN "tenantId" uuid NULL;
            RAISE NOTICE 'Added product_packages.tenantId';
          END IF;
        END IF;
        -- price_groups.tenantId
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='price_groups') THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name='price_groups' AND column_name='tenantId'
          ) THEN
            ALTER TABLE "price_groups" ADD COLUMN "tenantId" uuid NULL;
            RAISE NOTICE 'Added price_groups.tenantId';
          END IF;
        END IF;
        -- package_prices.tenantId
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='package_prices') THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name='package_prices' AND column_name='tenantId'
          ) THEN
            ALTER TABLE "package_prices" ADD COLUMN "tenantId" uuid NULL;
            RAISE NOTICE 'Added package_prices.tenantId';
          END IF;
        END IF;
        -- package_costs.tenantId
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='package_costs') THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name='package_costs' AND column_name='tenantId'
          ) THEN
            ALTER TABLE "package_costs" ADD COLUMN "tenantId" uuid NULL;
            RAISE NOTICE 'Added package_costs.tenantId';
          END IF;
        END IF;
        -- order_dispatch_logs.tenantId
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='order_dispatch_logs') THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name='order_dispatch_logs' AND column_name='tenantId'
          ) THEN
            ALTER TABLE "order_dispatch_logs" ADD COLUMN "tenantId" uuid NULL;
            RAISE NOTICE 'Added order_dispatch_logs.tenantId';
          END IF;
        END IF;
        -- ====== integrations (قد تكون مفقودة في الإنتاج) ======
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name='integrations'
        ) THEN
          CREATE TABLE "integrations" (
            "id" uuid PRIMARY KEY,
            "tenantId" uuid NOT NULL,
            "name" varchar(120) NOT NULL,
            "provider" varchar(20) NOT NULL,
            "scope" varchar(10) NOT NULL DEFAULT 'tenant',
            "baseUrl" varchar(255) NULL,
            "apiToken" varchar(255) NULL,
            "kod" varchar(120) NULL,
            "sifre" varchar(120) NULL,
            "createdAt" timestamptz NOT NULL DEFAULT now()
          );
          CREATE UNIQUE INDEX IF NOT EXISTS "ux_integrations_tenant_name" ON "integrations" ("tenantId","name");
          CREATE INDEX IF NOT EXISTS "idx_integrations_provider" ON "integrations" ("provider");
          CREATE INDEX IF NOT EXISTS "idx_integrations_scope" ON "integrations" ("scope");
          RAISE NOTICE 'Created table integrations';
        END IF;
        -- تأكد من وجود العمود scope لو كان الجدول قديماً بلا هذا العمود (يتسبب بخطأ 42703)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='integrations' AND column_name='scope'
        ) THEN
          ALTER TABLE "integrations" ADD COLUMN "scope" varchar(10) NOT NULL DEFAULT 'tenant';
          RAISE NOTICE 'Added integrations.scope column';
        END IF;
        -- تأكد من وجود العمود tenantId لو كان الجدول قديماً بلا هذا العمود (الخطأ الحالي يشير لغيابه)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='integrations' AND column_name='tenantId'
        ) THEN
          ALTER TABLE "integrations" ADD COLUMN "tenantId" uuid NULL; -- مبدئياً NULL
          UPDATE "integrations" SET "tenantId" = '00000000-0000-0000-0000-000000000000' WHERE "tenantId" IS NULL; -- عيّن قيمة ثابتة لأي صف موجود
          ALTER TABLE "integrations" ALTER COLUMN "tenantId" SET NOT NULL;
          RAISE NOTICE 'Added integrations.tenantId column and backfilled';
        END IF;
        -- الفهارس في حال أنشئ الجدول سابقاً بدونها
        BEGIN
          CREATE UNIQUE INDEX IF NOT EXISTS "ux_integrations_tenant_name" ON "integrations" ("tenantId","name");
        EXCEPTION WHEN others THEN NULL; END;
        BEGIN
          CREATE INDEX IF NOT EXISTS "idx_integrations_provider" ON "integrations" ("provider");
        EXCEPTION WHEN others THEN NULL; END;
        BEGIN
          CREATE INDEX IF NOT EXISTS "idx_integrations_scope" ON "integrations" ("scope");
        EXCEPTION WHEN others THEN NULL; END;
        -- currencies table may still be missing in some drifted envs before rescue migrations run.
        -- Guard all currency alterations by table existence to avoid PRELOAD failure (relation does not exist).
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name='currencies'
        ) THEN
          -- currencies.tenantId (اكتشفنا خطأ 42703 لعدم وجود العمود في الإنتاج)
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='tenantId'
          ) THEN
            ALTER TABLE "currencies" ADD COLUMN "tenantId" uuid NULL;
            RAISE NOTICE 'Added currencies.tenantId (NULLable for legacy rows)';
          END IF;
          -- Index & unique composite (ignore errors if exist already)
          BEGIN
            CREATE INDEX IF NOT EXISTS "idx_currencies_tenant" ON "currencies" ("tenantId");
          EXCEPTION WHEN others THEN NULL; END;
          BEGIN
            CREATE UNIQUE INDEX IF NOT EXISTS "uniq_currencies_tenant_code" ON "currencies" ("tenantId","code");
          EXCEPTION WHEN others THEN NULL; END;
        ELSE
          RAISE NOTICE 'Skipping currencies alterations (table missing) – expected if rescue migration not yet applied';
        END IF;
      END$$;
    `);
    const [usersHas] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='users' AND column_name='tenantId'`);
  const [tenantTable] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.tables WHERE table_name='tenant'`);
  const [tenantDomainTable] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.tables WHERE table_name='tenant_domain'`);
    const [ordersHas] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='product_orders' AND column_name='tenantId'`);
    const [productHas] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='product' AND column_name='tenantId'`);
    const [packagesHas] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='product_packages' AND column_name='tenantId'`);
    const [priceGroupsHas] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='price_groups' AND column_name='tenantId'`);
    const [packagePricesHas] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='package_prices' AND column_name='tenantId'`);
    const [packageCostsHas] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='package_costs' AND column_name='tenantId'`);
    const [dispatchLogsHas] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='order_dispatch_logs' AND column_name='tenantId'`);
    console.log('🧪 [Preflight] Exists:', {
  tenant: tenantTable?.c === 1,
  tenant_domain: tenantDomainTable?.c === 1,
      users: usersHas?.c === 1,
      product_orders: ordersHas?.c === 1,
      product: productHas?.c === 1,
      product_packages: packagesHas?.c === 1,
      price_groups: priceGroupsHas?.c === 1,
      package_prices: packagePricesHas?.c === 1,
      package_costs: packageCostsHas?.c === 1,
      order_dispatch_logs: dispatchLogsHas?.c === 1,
    });
    // تعبئة tenantId في الطلبات إن وجد المستخدم (تحقق أولاً من وجود العمود userId لتفادي الأخطاء)
    const [ordersUserIdCol] = await dataSource.query(`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='product_orders' AND column_name='userId'`);
    if (ordersUserIdCol?.c === 1) {
      await dataSource.query(`UPDATE "product_orders" o SET "tenantId" = u."tenantId" FROM "users" u WHERE o."userId" = u."id" AND o."tenantId" IS NULL;`);
    } else {
      console.warn('⚠️ [Preflight] Skipped filling product_orders.tenantId (userId column missing)');
    }
    // تعبئة tenantId للـ product_packages من product
    await dataSource.query(`UPDATE "product_packages" pp SET "tenantId" = p."tenantId" FROM "product" p WHERE pp."product_id" = p."id" AND pp."tenantId" IS NULL;`);
    // محاولة تعبئة tenantId للـ product من packages (عكسيًا) إذا كان المنتج مفقود tenantId
    await dataSource.query(`UPDATE "product" p SET "tenantId" = pp."tenantId" FROM "product_packages" pp WHERE pp."product_id" = p."id" AND p."tenantId" IS NULL AND pp."tenantId" IS NOT NULL;`);
    const nullCount = await dataSource.query(`SELECT count(*)::int AS c FROM "product_orders" WHERE "tenantId" IS NULL`);
    const prodNull = await dataSource.query(`SELECT count(*)::int AS c FROM "product" WHERE "tenantId" IS NULL`);
    const pkgNull = await dataSource.query(`SELECT count(*)::int AS c FROM "product_packages" WHERE "tenantId" IS NULL`);
    const priceGroupNull = await dataSource.query(`SELECT count(*)::int AS c FROM "price_groups" WHERE "tenantId" IS NULL`);
    const packagePricesNull = await dataSource.query(`SELECT count(*)::int AS c FROM "package_prices" WHERE "tenantId" IS NULL`);
    const packageCostsNull = await dataSource.query(`SELECT count(*)::int AS c FROM "package_costs" WHERE "tenantId" IS NULL`);
    const dispatchLogsNull = await dataSource.query(`SELECT count(*)::int AS c FROM "order_dispatch_logs" WHERE "tenantId" IS NULL`);
    console.log('🧪 [Preflight] product_orders rows with tenantId NULL after fill:', nullCount[0]?.c);
    console.log('🧪 [Preflight] product rows NULL:', prodNull[0]?.c,
      '| product_packages NULL:', pkgNull[0]?.c,
      '| price_groups NULL:', priceGroupNull[0]?.c,
      '| package_prices NULL:', packagePricesNull[0]?.c,
      '| package_costs NULL:', packageCostsNull[0]?.c,
      '| dispatch_logs NULL:', dispatchLogsNull[0]?.c);
    // فهارس سريعة (إن لم تكن موجودة)
    await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_users_tenant" ON "users" ("tenantId");`);
    await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_orders_tenant" ON "product_orders" ("tenantId");`);
    await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_product_tenant" ON "product" ("tenantId");`);
    await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_product_packages_tenant" ON "product_packages" ("tenantId");`);
  await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_price_groups_tenant" ON "price_groups" ("tenantId");`);
  await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_package_prices_tenant" ON "package_prices" ("tenantId");`);
  await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_package_costs_tenant" ON "package_costs" ("tenantId");`);
  await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_order_dispatch_logs_tenant" ON "order_dispatch_logs" ("tenantId");`);
    console.log('✅ [Preflight] Tenant columns/indices ensured');
  } catch (e: any) {
    console.warn('⚠️ Preflight tenant columns patch failed (يمكن تجاهله إن وُجدت الأعمدة):', e?.message || e);
  }

  // Conditional rescue for orderUuid column & index (idempotency) – can be disabled via DISABLE_ORDERUUID_RESCUE=true
  if ((process.env.DISABLE_ORDERUUID_RESCUE || '').toLowerCase() !== 'true') {
    try {
      const [col] = await dataSource.query(`SELECT 1 FROM information_schema.columns WHERE table_name='product_orders' AND column_name='orderUuid'`);
      if (!col) {
        await dataSource.query(`ALTER TABLE "product_orders" ADD COLUMN "orderUuid" varchar(64)`);
        console.log('🛠 [Rescue] Added product_orders.orderUuid');
      }
      // Ensure partial unique index (ignore errors if drifted)
      await dataSource.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_orders_tenant_user_orderUuid" ON "product_orders" ("tenantId","userId","orderUuid") WHERE "orderUuid" IS NOT NULL`);
      console.log('🛠 [Rescue] Ensured uq_orders_tenant_user_orderUuid');
    } catch (e:any) {
      console.warn('⚠️ [Rescue] orderUuid ensure failed:', e?.message);
    }
  } else {
    console.log('⏭ [Rescue] orderUuid rescue disabled by env flag');
  }
  // (Removed original late migration run; now executed earlier)

  // Lightweight health check for orderUuid idempotency infrastructure
  try {
    const [col] = await dataSource.query(`SELECT 1 AS c FROM information_schema.columns WHERE table_name='product_orders' AND column_name='orderUuid'`);
    const [idx] = await dataSource.query(`SELECT 1 AS c FROM pg_indexes WHERE tablename='product_orders' AND indexname='uq_orders_tenant_user_orderUuid'`);
    console.log('[Health] orderUuid column=%s index=%s (rescue=%s)', col ? 'OK' : 'MISSING', idx ? 'OK' : 'MISSING', (process.env.DISABLE_ORDERUUID_RESCUE || '').toLowerCase() === 'true' ? 'disabled' : 'active');
  } catch (e:any) {
    console.warn('[Health] orderUuid check failed:', e?.message);
  }

  // Rescue: ensure client_api_webhook_outbox table & indices exist (to avoid 42P01 in worker if migration not applied yet)
  try {
    const [tbl] = await dataSource.query(`SELECT 1 FROM information_schema.tables WHERE table_name='client_api_webhook_outbox'`);
    if (!tbl) {
      await dataSource.query(`CREATE TABLE IF NOT EXISTS "client_api_webhook_outbox" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "event_type" varchar(64) NOT NULL,
        "delivery_url" varchar(600) NOT NULL,
        "payload_json" ${process.env.TEST_DB_SQLITE === 'true' ? 'text' : 'jsonb'} NOT NULL,
        "headers_json" ${process.env.TEST_DB_SQLITE === 'true' ? 'text' : 'jsonb'} NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "attempt_count" int NOT NULL DEFAULT 0,
        "next_attempt_at" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NULL,
        "last_error" text NULL,
        "response_code" int NULL,
        "created_at" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NOT NULL DEFAULT now(),
        "updated_at" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NOT NULL DEFAULT now()
      )`);
      console.log('🛠 [Rescue] Created client_api_webhook_outbox table');
    }
    // Indices (idempotent)
    await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_client_webhook_outbox_next" ON "client_api_webhook_outbox" ("status","next_attempt_at")`);
    await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_client_webhook_outbox_tenant" ON "client_api_webhook_outbox" ("tenantId")`);
    await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_client_webhook_outbox_user" ON "client_api_webhook_outbox" ("userId")`);
  } catch (e:any) {
    console.warn('⚠️ [Rescue] webhook outbox ensure failed:', e?.message);
  }

  // Rescue: ensure client_api_request_logs table & indices (prevents migration/index failures if base table drifted)
  try {
    const [logsTbl] = await dataSource.query(`SELECT 1 FROM information_schema.tables WHERE table_name='client_api_request_logs'`);
    if (!logsTbl) {
      await dataSource.query(`CREATE TABLE IF NOT EXISTS "client_api_request_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "method" varchar(60) NOT NULL,
        "path" varchar(200) NOT NULL,
        "ip" varchar(64),
        "code" int NOT NULL,
        "createdAt" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NOT NULL DEFAULT now()
      )`);
      console.log('🛠 [Rescue] Created client_api_request_logs table');
    }
    await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_client_api_logs_user" ON "client_api_request_logs" ("userId")`);
    await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_client_api_logs_user_created" ON "client_api_request_logs" ("userId","createdAt")`);
    await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_client_api_logs_tenant_created" ON "client_api_request_logs" ("tenantId","createdAt")`);
  } catch (e:any) {
    console.warn('⚠️ [Rescue] client_api_request_logs ensure failed:', e?.message);
  }

  if ((process.env.BOOTSTRAP_ENABLED || 'true').toLowerCase() === 'true') {
    try {
      const userRepo = dataSource.getRepository(User);
      // ابحث عن أي مستخدم مالك منصة حالي
      const existing = await userRepo.createQueryBuilder('u')
        .where('u.role = :role', { role: 'instance_owner' })
        .andWhere('u.tenantId IS NULL')
        .getOne();
      if (!existing) {
        const email = process.env.INITIAL_ROOT_EMAIL;
        const username = process.env.INITIAL_ROOT_USERNAME || (email ? email.split('@')[0] : 'root');
        const passwordPlain = process.env.INITIAL_ROOT_PASSWORD;
        if (!email || !passwordPlain) {
          console.warn('⚠️ Skipping root bootstrap: INITIAL_ROOT_EMAIL or INITIAL_ROOT_PASSWORD missing');
        } else {
          const hash = await bcrypt.hash(passwordPlain, 10);
          const user = userRepo.create({
            email,
            username,
            password: hash,
            role: 'instance_owner',
            tenantId: null,
            isActive: true,
            balance: 0,
          });
          await userRepo.save(user);
          console.log('✅ Bootstrap root user created:', { email, username });
        }
      } else if ((process.env.RESET_ROOT_ON_DEPLOY || 'false').toLowerCase() === 'true') {
        const passwordPlain = process.env.INITIAL_ROOT_PASSWORD;
        if (passwordPlain) {
          existing.password = await bcrypt.hash(passwordPlain, 10);
          await userRepo.save(existing);
          console.log('🔄 Root user password reset');
        } else {
          console.warn('⚠️ RESET_ROOT_ON_DEPLOY=true ولكن لا توجد INITIAL_ROOT_PASSWORD');
        }
      } else {
        // موجود بالفعل ولا إعادة ضبط
        // لا طباعة حساسة لكلمة السر
        console.log('ℹ️ Root user already exists (instance_owner).');
      }
    } catch (e: any) {
      console.error('❌ Bootstrap root user failed:', e?.message || e);
    }
  } else {
    console.log('⏭ Root bootstrap disabled (BOOTSTRAP_ENABLED=false)');
  }

  // إحصاءات عامة للمستخدمين العالميين (tenantId NULL)
  try {
    const globalRoleStats = await dataSource.query(`SELECT role, count(*) FROM users WHERE "tenantId" IS NULL GROUP BY role`);
    console.log('[BOOTSTRAP][GLOBAL-STATS] tenantId NULL counts:', globalRoleStats);
  const globalUsersSample = await dataSource.query(`SELECT email, role, "tenantId" FROM users WHERE "tenantId" IS NULL ORDER BY "createdAt" DESC LIMIT 10`);
  console.log('[BOOTSTRAP][GLOBAL-LIST] sample (max 10):', globalUsersSample);
  } catch (e:any) {
    console.warn('[BOOTSTRAP][GLOBAL-STATS] Failed to read stats:', e.message || e);
  }

  // مفعّل افتراضياً مع BOOTSTRAP_ENABLED، ويستخدم INITIAL_DEV_EMAIL + INITIAL_DEV_PASSWORD
  // (أزيل من التشغيل التلقائي) تم تعطيل إنشاء المطوّر تلقائياً.
  // الآن الإنشاء يتم فقط عبر endpoint: POST /api/auth/bootstrap-developer
  // يمكنك حذف متغيرات INITIAL_DEV_EMAIL و INITIAL_DEV_PASSWORD و RESET_DEV_ON_DEPLOY من البيئة.

  await app.listen(port, host);

  // Run schema guard AFTER migrations & bootstrap listen so it doesn't block startup.
  try {
    const guard = app.get(SchemaGuardService);
    await guard.verify();
  } catch (e: any) {
    console.warn('⚠️ [SchemaGuard] Could not run verification:', e?.message || e);
  }

  // ✅ اختبار اتصال DB بعد الاستماع
  try {
    await dataSource.query('SELECT NOW()');
    console.log('✅ Database connected:', {
      host: process.env.DB_HOST,
      db: process.env.DB_NAME,
      user: process.env.DB_USERNAME,
    });
  } catch (error: any) {
    console.error('❌ Database connection failed:', error?.message || error);
  }

  // ✅ طباعة المسارات المتاحة
  const httpAdapter = app.getHttpAdapter();
  const instance: any = httpAdapter.getInstance();
  const router = instance?._router;
  if (router?.stack) {
    const availableRoutes = router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        method: Object.keys(layer.route.methods)[0]?.toUpperCase() || 'GET',
        path: '/api' + layer.route.path,
      }));
    console.table(availableRoutes);
  }

  console.log(`🚀 API running on http://${host}:${port}/api`);
  console.log(`📘 Swagger at        http://${host}:${port}/api/docs`);
}

bootstrap();
