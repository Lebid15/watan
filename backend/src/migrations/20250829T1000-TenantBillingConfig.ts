import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantBillingConfig20250829T1000 implements MigrationInterface {
  name = 'TenantBillingConfig20250829T1000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create table if not exists (quoted billingAnchor to preserve case in checks later)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_billing_config'
        ) THEN
          CREATE TABLE "tenant_billing_config" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "tenantId" uuid NOT NULL,
            "monthlyPriceUsd" numeric(18,6),
            "billingAnchor" varchar(8) NOT NULL DEFAULT 'EOM',
            "graceDays" int NOT NULL DEFAULT 3,
            "isEnforcementEnabled" boolean NOT NULL DEFAULT false,
            "fxUsdToTenantAtInvoice" boolean NOT NULL DEFAULT true,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_tenant_billing_config_id" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_tenant_billing_config_tenant" UNIQUE ("tenantId")
          );
        END IF;
      END$$;
    `);

    // Index on tenantId
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tenant_billing_config_tenant" ON "tenant_billing_config" ("tenantId");`);

    // Check constraint (idempotent)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_tenant_billing_config_anchor') THEN
          BEGIN
            ALTER TABLE "tenant_billing_config"
              ADD CONSTRAINT "CHK_tenant_billing_config_anchor"
              CHECK ("billingAnchor" IN ('EOM','DOM'));
          EXCEPTION WHEN others THEN NULL; END;
        END IF;
      END$$;
    `);

    // FK to tenant (idempotent / tolerant)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tenant_billing_config_tenant') THEN
          BEGIN
            ALTER TABLE "tenant_billing_config"
              ADD CONSTRAINT "FK_tenant_billing_config_tenant"
              FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          EXCEPTION WHEN others THEN NULL; END;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_billing_config";`);
  }
}
