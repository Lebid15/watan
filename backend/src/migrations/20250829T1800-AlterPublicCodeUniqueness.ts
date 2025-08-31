import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adjust publicCode uniqueness to be per-tenant instead of global.
 * Drops old unique index (if exists) and creates new composite unique on (tenantId, publicCode).
 */
export class AlterPublicCodeUniqueness20250829T1800 implements MigrationInterface {
  name = 'AlterPublicCodeUniqueness20250829T1800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Try drop old unique index if exists
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_product_packages_public_code') THEN
        EXECUTE 'DROP INDEX "ux_product_packages_public_code"';
      END IF;
    END $$;`);

    // Create new unique composite index (quote "publicCode" in predicate to avoid case-folding to publiccode)
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_product_packages_tenant_public_code') THEN
        EXECUTE 'CREATE UNIQUE INDEX "ux_product_packages_tenant_public_code" ON "product_packages" ("tenantId", "publicCode") WHERE "publicCode" IS NOT NULL';
      END IF;
    END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: drop composite and recreate old global unique
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_product_packages_tenant_public_code') THEN
        EXECUTE 'DROP INDEX "ux_product_packages_tenant_public_code"';
      END IF;
    END $$;`);
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_product_packages_public_code') THEN
        EXECUTE 'CREATE UNIQUE INDEX "ux_product_packages_public_code" ON "product_packages" ("publicCode") WHERE "publicCode" IS NOT NULL';
      END IF;
    END $$;`);
  }
}
