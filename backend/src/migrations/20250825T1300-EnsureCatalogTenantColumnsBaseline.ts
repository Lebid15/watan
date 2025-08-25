import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive baseline to ensure catalog tables have tenantId columns & indexes
 * and tenant.code unique index (idempotent / rescue style). Safe to re-run.
 */
export class EnsureCatalogTenantColumnsBaseline20250825T1300 implements MigrationInterface {
  name = 'EnsureCatalogTenantColumnsBaseline20250825T1300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    DO $$
    BEGIN
      -- tenant.code unique index safeguard
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenant' AND column_name='code') THEN
        BEGIN
          CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_code_unique" ON "tenant" ("code");
        EXCEPTION WHEN others THEN NULL; END;
      END IF;

      -- catalog_product.tenantId
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='catalog_product') THEN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='catalog_product' AND column_name='tenantId'
        ) THEN
          ALTER TABLE "catalog_product" ADD COLUMN "tenantId" uuid NULL;
          UPDATE "catalog_product" SET "tenantId"='00000000-0000-0000-0000-000000000000' WHERE "tenantId" IS NULL;
          ALTER TABLE "catalog_product" ALTER COLUMN "tenantId" SET NOT NULL;
        END IF;
        BEGIN CREATE INDEX IF NOT EXISTS "idx_catalog_product_tenant" ON "catalog_product" ("tenantId"); EXCEPTION WHEN others THEN NULL; END;
      END IF;

      -- catalog_package.tenantId
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='catalog_package') THEN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_name='catalog_package' AND column_name='tenantId'
        ) THEN
          ALTER TABLE "catalog_package" ADD COLUMN "tenantId" uuid NULL;
          UPDATE "catalog_package" SET "tenantId"='00000000-0000-0000-0000-000000000000' WHERE "tenantId" IS NULL;
          ALTER TABLE "catalog_package" ALTER COLUMN "tenantId" SET NOT NULL;
        END IF;
        BEGIN CREATE INDEX IF NOT EXISTS "idx_catalog_package_tenant" ON "catalog_package" ("tenantId"); EXCEPTION WHEN others THEN NULL; END;
      END IF;
    END $$;`);
  }

  public async down(): Promise<void> {
    // Non destructive: no down.
  }
}
