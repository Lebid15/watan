import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensure legacy unique index (tenantId, publicCode) is removed
 * and new scope unique index (product_id, publicCode) exists on Postgres.
 * Safe to run multiple times (idempotent) and no-op on SQLite.
 */
export class FixProductPackagePublicCodeIndex20250830T2200 implements MigrationInterface {
  name = 'FixProductPackagePublicCodeIndex20250830T2200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = (queryRunner.connection.options as any).type;
    if (driver !== 'postgres') return; // skip for sqlite tests

    // Drop old unique index if it still exists
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_product_packages_tenant_public_code') THEN
        EXECUTE 'DROP INDEX IF EXISTS public."ux_product_packages_tenant_public_code"';
      END IF;
    END$$;`);

    // Create new unique partial index if missing
    await queryRunner.query(`DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_product_packages_product_public_code') THEN
        EXECUTE 'CREATE UNIQUE INDEX "ux_product_packages_product_public_code" ON public.product_packages (product_id, "publicCode") WHERE "publicCode" IS NOT NULL';
      END IF;
    END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = (queryRunner.connection.options as any).type;
    if (driver !== 'postgres') return;

    // Drop new index
    await queryRunner.query(`DROP INDEX IF EXISTS public."ux_product_packages_product_public_code"`);
    // Optionally re-create old index (not strictly needed anymore)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_product_packages_tenant_public_code" ON public.product_packages ("tenantId", "publicCode") WHERE "publicCode" IS NOT NULL`);
  }
}
