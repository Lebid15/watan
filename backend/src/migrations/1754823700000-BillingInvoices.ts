import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BillingInvoices migration placed AFTER AddPayments (1754823000000) and AddDepositFKs (1754823600001)
 * Uses idempotent guards so it can be re-run safely if a partial table exists.
 */
export class BillingInvoices1754823700000 implements MigrationInterface {
  name = 'BillingInvoices1754823700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create table if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_invoices'
        ) THEN
          CREATE TABLE "billing_invoices" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "tenantId" uuid NOT NULL,
            "periodStart" date NOT NULL,
            "periodEnd" date NOT NULL,
            "amountUsd" numeric(18,6) NOT NULL,
            "fxUsdToTenantAtInvoice" numeric(18,6),
            "displayCurrencyCode" varchar(10),
            "status" varchar(8) NOT NULL DEFAULT 'open',
            "issuedAt" timestamptz NOT NULL DEFAULT now(),
            "dueAt" timestamptz,
            "paidAt" timestamptz,
            "depositId" uuid,
            "notes" text,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_billing_invoices_id" PRIMARY KEY ("id")
          );
        END IF;
      END$$;
    `);

    // Unique constraint (tenantId, periodStart, periodEnd)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_billing_invoices_tenant_period'
        ) THEN
          ALTER TABLE "billing_invoices"
            ADD CONSTRAINT "UQ_billing_invoices_tenant_period"
            UNIQUE ("tenantId", "periodStart", "periodEnd");
        END IF;
      END$$;
    `);

    // Check constraint on status
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_billing_invoices_status'
        ) THEN
          ALTER TABLE "billing_invoices"
            ADD CONSTRAINT "CHK_billing_invoices_status"
            CHECK (status IN ('open','paid','void'));
        END IF;
      END$$;
    `);

    // Foreign keys (safe)
    await queryRunner.query(`
      DO $$
      BEGIN
        -- FK tenant
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_billing_invoices_tenant') THEN
          BEGIN
            ALTER TABLE "billing_invoices"
              ADD CONSTRAINT "FK_billing_invoices_tenant"
              FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          EXCEPTION WHEN others THEN NULL; END;
        END IF;
        -- FK deposit
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_billing_invoices_deposit') THEN
          BEGIN
            ALTER TABLE "billing_invoices"
              ADD CONSTRAINT "FK_billing_invoices_deposit"
              FOREIGN KEY ("depositId") REFERENCES "deposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          EXCEPTION WHEN others THEN NULL; END;
        END IF;
      END$$;
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_billing_invoices_tenant_status" ON "billing_invoices" ("tenantId", "status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_billing_invoices_dueAt" ON "billing_invoices" ("dueAt");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_billing_invoices_dueAt";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_billing_invoices_tenant_status";`);
    await queryRunner.query(`ALTER TABLE "billing_invoices" DROP CONSTRAINT IF EXISTS "FK_billing_invoices_deposit";`);
    await queryRunner.query(`ALTER TABLE "billing_invoices" DROP CONSTRAINT IF EXISTS "FK_billing_invoices_tenant";`);
    await queryRunner.query(`ALTER TABLE "billing_invoices" DROP CONSTRAINT IF EXISTS "CHK_billing_invoices_status";`);
    await queryRunner.query(`ALTER TABLE "billing_invoices" DROP CONSTRAINT IF EXISTS "UQ_billing_invoices_tenant_period";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_invoices";`);
  }
}
