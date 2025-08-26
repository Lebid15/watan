import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FixSchemaDrift20250826T1900
 * Adds missing tenantId to order_dispatch_logs if absent and ensures currencies table exists / has tenantId.
 * Idempotent and safe to run multiple times.
 */
export class FixSchemaDrift20250826T1900 implements MigrationInterface {
  name = 'FixSchemaDrift20250826T1900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
    BEGIN
      -- Ensure currencies table exists (it should already) with minimal columns used elsewhere
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='currencies') THEN
        CREATE TABLE "currencies" (
          "id" uuid PRIMARY KEY,
          "tenantId" uuid NULL,
          "code" varchar(10) NOT NULL,
          "rateToUsd" numeric(18,6) NULL,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now()
        );
        BEGIN
          CREATE INDEX IF NOT EXISTS "idx_currencies_tenant" ON "currencies" ("tenantId");
        EXCEPTION WHEN others THEN NULL; END;
        BEGIN
          CREATE UNIQUE INDEX IF NOT EXISTS "uniq_currencies_tenant_code" ON "currencies" ("tenantId","code");
        EXCEPTION WHEN others THEN NULL; END;
      ELSE
        -- Ensure tenantId column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='tenantId') THEN
          ALTER TABLE "currencies" ADD COLUMN "tenantId" uuid NULL;
        END IF;
        -- Ensure code column (edge case if drifted severely)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='currencies' AND column_name='code') THEN
          ALTER TABLE "currencies" ADD COLUMN "code" varchar(10) NOT NULL DEFAULT 'USD';
        END IF;
        BEGIN
          CREATE INDEX IF NOT EXISTS "idx_currencies_tenant" ON "currencies" ("tenantId");
        EXCEPTION WHEN others THEN NULL; END;
        BEGIN
          CREATE UNIQUE INDEX IF NOT EXISTS "uniq_currencies_tenant_code" ON "currencies" ("tenantId","code");
        EXCEPTION WHEN others THEN NULL; END;
      END IF;

      -- Add tenantId to order_dispatch_logs if missing
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='order_dispatch_logs') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_dispatch_logs' AND column_name='tenantId') THEN
          ALTER TABLE "order_dispatch_logs" ADD COLUMN "tenantId" uuid NULL;
          -- Optional backfill: try infer from order -> product_orders.tenantId if column exists
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_orders' AND column_name='tenantId') THEN
            UPDATE "order_dispatch_logs" l
              SET "tenantId" = o."tenantId"
            FROM "product_orders" o
            WHERE l."order_id" = o."id" AND l."tenantId" IS NULL;
          END IF;
        END IF;
        BEGIN
          CREATE INDEX IF NOT EXISTS "idx_order_dispatch_logs_tenant" ON "order_dispatch_logs" ("tenantId");
        EXCEPTION WHEN others THEN NULL; END;
      END IF;
    END $$;`);
  }

  public async down(): Promise<void> {
    // Forward-only migration: no rollback.
  }
}
