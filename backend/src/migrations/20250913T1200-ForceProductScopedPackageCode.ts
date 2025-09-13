import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Force product-scoped uniqueness for product_packages.publicCode
 * - Drop any lingering tenant-level unique index
 * - Ensure product-level unique partial index exists
 * Idempotent and safe to re-run.
 */
export class ForceProductScopedPackageCode20250913T1200 implements MigrationInterface {
  name = 'ForceProductScopedPackageCode20250913T1200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = (queryRunner.connection.options as any).type;
    if (driver !== 'postgres') return;

    // Drop tenant-level unique index variants if they still exist
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_product_packages_tenant_public_code') THEN
        EXECUTE 'DROP INDEX IF EXISTS public."ux_product_packages_tenant_public_code"';
      END IF;
    END$$;`);

    // Ensure product-level partial unique index present
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

    // Rollback: drop product-level index, recreate tenant-level index (legacy)
    await queryRunner.query('DROP INDEX IF EXISTS public."ux_product_packages_product_public_code"');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_product_packages_tenant_public_code" ON public.product_packages ("tenantId", "publicCode") WHERE "publicCode" IS NOT NULL');
  }
}
