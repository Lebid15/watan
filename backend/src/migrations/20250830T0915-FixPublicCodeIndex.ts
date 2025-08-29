import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repair migration: ensures composite per-tenant unique index on (tenantId, "publicCode")
 * with proper quoting (previous migration failed because it used unquoted publicCode in WHERE clause
 * while the column exists quoted as "publicCode", causing PostgreSQL to look for publiccode).
 */
export class FixPublicCodeIndex20250830T0915 implements MigrationInterface {
  name = 'FixPublicCodeIndex20250830T0915';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Detect column case and optionally rename if only lowercase exists
    await queryRunner.query(`DO $$ BEGIN
      -- If mixed-case "publicCode" column missing but lowercase exists, rename it to mixed case
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
         WHERE table_name='product_packages' AND column_name='publicCode'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
         WHERE table_name='product_packages' AND column_name='publiccode'
      ) THEN
        ALTER TABLE "product_packages" RENAME COLUMN publiccode TO "publicCode";
      END IF;
    END $$;`);

    // 2. Drop any old indexes (both composite & global) that may conflict
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_tenant_public_code";`);
  await queryRunner.query(`DROP INDEX IF EXISTS ux_product_packages_tenant_public_code;`); /* unquoted variant */
  // legacy global unique variants
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_public_code";`);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_product_packages_public_code;`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_public_code_tenant";`);

    // 3. Create new composite unique with proper quoting & partial condition
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_product_packages_tenant_public_code" ON "product_packages" ("tenantId", "publicCode") WHERE "publicCode" IS NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to global unique (NOT recommended, but for down path completeness)
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_tenant_public_code";`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_product_packages_public_code" ON "product_packages" ("publicCode") WHERE "publicCode" IS NOT NULL;`);
  }
}
