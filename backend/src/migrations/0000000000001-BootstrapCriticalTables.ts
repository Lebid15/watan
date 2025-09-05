import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bootstrap critical baseline tables with a guaranteed earliest timestamp so that
 * later rescue / additive migrations (whose filenames include non-numeric prefixes
 * like `2025...T...`) don't execute before the underlying tables exist.
 *
 * This is needed because several migration filenames in the project deviate from the
 * standard TypeORM pattern `<timestamp>-<Name>` (pure leading digits). TypeORM derives
 * ordering from the leading numeric portion; names containing letters early (e.g. `CreateProductBaseline...`)
 * or timestamps with a `T` cause those migrations to be sorted unexpectedly. As a result
 * migrations that ALTER product tables may run before any CREATE statements executed, producing 42P01.
 *
 * The migration is idempotent: each CREATE TABLE / INDEX is guarded by existence checks.
 * It purposefully only creates the minimum columns required for subsequent migrations to succeed;
 * later migrations will add any missing columns / constraints.
 */
export class BootstrapCriticalTables0000000000001 implements MigrationInterface {
  name = 'BootstrapCriticalTables0000000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extensions (either pgcrypto for gen_random_uuid or uuid-ossp) – tolerate failures.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    // product table (minimal baseline)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product') THEN
          CREATE TABLE "product" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tenantId" uuid NOT NULL,
            "name" varchar NOT NULL,
            "description" text NULL,
            "imageUrl" varchar NULL,
            "isActive" boolean NOT NULL DEFAULT true
          );
        END IF;
      END$$;
      CREATE INDEX IF NOT EXISTS "idx_product_tenantId" ON "product" ("tenantId");
    `);

    // product_orders table (baseline subset — later migrations add more columns if missing)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product_orders') THEN
          CREATE TABLE "product_orders" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tenantId" uuid NULL,
            "orderNo" int NULL,
            "productId" uuid NULL,
            "packageId" uuid NULL,
            "quantity" int NOT NULL DEFAULT 1,
            "sellPriceCurrency" varchar(10) NOT NULL DEFAULT 'USD',
            "sellPriceAmount" numeric(10,2) NOT NULL DEFAULT 0,
            "price" numeric(10,2) NOT NULL DEFAULT 0,
            "costCurrency" varchar(10) NOT NULL DEFAULT 'USD',
            "costAmount" numeric(10,2) NOT NULL DEFAULT 0,
            "profitAmount" numeric(10,2) NOT NULL DEFAULT 0,
            "status" varchar NOT NULL DEFAULT 'pending',
            "userId" uuid NULL,
            "userIdentifier" varchar NULL,
            "extraField" varchar NULL,
            "providerId" varchar NULL,
            "externalOrderId" varchar NULL,
            "externalStatus" varchar NOT NULL DEFAULT 'not_sent',
            "attempts" int NOT NULL DEFAULT 0,
            "lastMessage" varchar(250) NULL,
            "manualNote" text NULL,
            "notes" jsonb NOT NULL DEFAULT '[]',
            "pinCode" varchar(120) NULL,
            "sentAt" timestamptz NULL,
            "lastSyncAt" timestamptz NULL,
            "completedAt" timestamptz NULL,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "notesCount" int NOT NULL DEFAULT 0
          );
        END IF;
      END$$;
      CREATE INDEX IF NOT EXISTS "idx_orders_tenant" ON "product_orders" ("tenantId");
    `);

    // product_packages baseline (needed for later FK / price tables)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product_packages') THEN
          CREATE TABLE "product_packages" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tenantId" uuid NOT NULL,
            "publicCode" varchar(40) NULL,
            "name" varchar(160) NULL,
            "description" text NULL,
            "imageUrl" varchar NULL,
            "basePrice" numeric(10,2) NOT NULL DEFAULT 0,
            "capital" numeric(10,2) NOT NULL DEFAULT 0,
            "isActive" boolean NOT NULL DEFAULT true,
            "product_id" uuid NULL
          );
        END IF;
      END$$;
      CREATE INDEX IF NOT EXISTS "idx_product_packages_tenant" ON "product_packages" ("tenantId");
    `);

    // error_logs baseline table (some runtime code tries to upsert here early)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='error_logs') THEN
          CREATE TABLE "error_logs" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "source" varchar NULL,
            "level" varchar NULL,
            "status" int NULL,
            "message" text NULL,
            "name" varchar NULL,
            "stack" text NULL,
            "path" varchar NULL,
            "method" varchar NULL,
            "userId" uuid NULL,
            "tenantId" uuid NULL,
            "userAgent" text NULL,
            "context" jsonb NULL,
            "hash" varchar NULL,
            "occurrenceCount" int NOT NULL DEFAULT 1,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            "firstOccurredAt" timestamptz NULL,
            "lastOccurredAt" timestamptz NULL,
            "resolvedAt" timestamptz NULL
          );
        END IF;
      END$$;
    `);

    // tenant_domain minimal (guards & domain resolution)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenant_domain') THEN
          CREATE TABLE "tenant_domain" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tenantId" uuid NOT NULL,
            "domain" varchar NOT NULL,
            "type" varchar NULL,
            "isPrimary" boolean NOT NULL DEFAULT false,
            "isVerified" boolean NOT NULL DEFAULT false,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now()
          );
        END IF;
      END$$;
      CREATE INDEX IF NOT EXISTS "idx_tenant_domain_domain" ON "tenant_domain" ("domain");
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No destructive rollback; keep tables as baseline for environment stability.
  }
}
