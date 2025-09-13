import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drop tenant-level unique index on (tenantId, publicCode) permanently so that publicCode uniqueness is product-scoped only.
 * Idempotent.
 */
export class DropTenantPackagePublicCodeIndex20250913T1400 implements MigrationInterface {
  name = 'DropTenantPackagePublicCodeIndex20250913T1400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = (queryRunner.connection.options as any).type;
    if (driver !== 'postgres') return;
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_product_packages_tenant_public_code') THEN
        EXECUTE 'DROP INDEX IF EXISTS public."ux_product_packages_tenant_public_code"';
      END IF;
    END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = (queryRunner.connection.options as any).type;
    if (driver !== 'postgres') return;
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "ux_product_packages_tenant_public_code" ON public.product_packages ("tenantId", "publicCode") WHERE "publicCode" IS NOT NULL');
  }
}
