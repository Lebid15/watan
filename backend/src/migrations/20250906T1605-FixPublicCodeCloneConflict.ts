import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix cloning of global products failing due to global unique index on publicCode.
 * We allow the same publicCode to exist across different tenants (and across different products)
 * when cloning global catalog items. Uniqueness should only be enforced within a single product.
 *
 * This migration drops any legacy global unique index `ux_product_packages_public_code`
 * and re-creates the per-product scoped unique index (product_id, publicCode) with a NULL filter.
 */
export class FixPublicCodeCloneConflict20250906T1605 implements MigrationInterface {
  name = 'FixPublicCodeCloneConflict20250906T1605';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop legacy global unique indexes if they still exist
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_product_packages_public_code') THEN
        EXECUTE 'DROP INDEX "ux_product_packages_public_code"';
      END IF;
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_product_packages_public_code_tenant') THEN
        EXECUTE 'DROP INDEX "ux_product_packages_public_code_tenant"';
      END IF;
    END$$;`);

    // Create the intended per-product unique index (matches entity decorator)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_product_packages_product_public_code ON product_packages (product_id, "publicCode") WHERE "publicCode" IS NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: drop the per-product index; (do NOT recreate the old global one automatically)
    await queryRunner.query(`DROP INDEX IF EXISTS ux_product_packages_product_public_code;`);
    // Recreate a global unique index only if really needed (left commented intentionally):
    // await queryRunner.query(`CREATE UNIQUE INDEX ux_product_packages_public_code ON product_packages ("publicCode") WHERE "publicCode" IS NOT NULL;`);
  }
}
