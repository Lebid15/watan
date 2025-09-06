import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrective migration: ensure package_routing table has tenantId column and proper unique constraint (tenantId, package_id).
 * Previous deployments created table without tenant linkage causing runtime errors (PackageRouting.tenantId). Idempotent.
 */
export class FixPackageRoutingTenantId20250906T2030 implements MigrationInterface {
  name = 'FixPackageRoutingTenantId20250906T2030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists: any[] = await queryRunner.query(`SELECT 1 FROM information_schema.tables WHERE table_name='package_routing'`);
    if (tableExists.length === 0) return; // nothing to do

    // 1) Add tenantId column if missing (nullable first for backfill)
    await queryRunner.query(`ALTER TABLE "package_routing" ADD COLUMN IF NOT EXISTS "tenantId" uuid`);

    // 2) Backfill tenantId using product_packages.tenantId via package_id FK if possible
    await queryRunner.query(`
      UPDATE package_routing pr
      SET "tenantId" = pp."tenantId"
      FROM product_packages pp
      WHERE pr.package_id = pp.id
        AND pr."tenantId" IS NULL
    `);

    // 3) If all rows filled, enforce NOT NULL
    const nulls: any[] = await queryRunner.query(`SELECT COUNT(*)::int AS cnt FROM package_routing WHERE "tenantId" IS NULL`);
    if (Number(nulls?.[0]?.cnt || 0) === 0) {
      try { await queryRunner.query(`ALTER TABLE "package_routing" ALTER COLUMN "tenantId" SET NOT NULL`); } catch { /* ignore */ }
    }

    // 4) Adjust unique constraints: drop old single-package constraint, add new composite (tenantId, package_id)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name='ux_package_routing_package' AND table_name='package_routing'
        ) THEN
          ALTER TABLE "package_routing" DROP CONSTRAINT "ux_package_routing_package";
        END IF;
      END $$;`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name='ux_package_routing_package_tenant' AND table_name='package_routing'
        ) THEN
          ALTER TABLE "package_routing" ADD CONSTRAINT "ux_package_routing_package_tenant" UNIQUE ("tenantId", "package_id");
        END IF;
      END $$;`);

    // 5) Index tenantId if not already via constraint (optional explicit index)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_package_routing_tenant ON package_routing ("tenantId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Down: drop new composite unique, restore old (package only) if column still there, then drop tenantId
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name='ux_package_routing_package_tenant' AND table_name='package_routing'
        ) THEN
          ALTER TABLE "package_routing" DROP CONSTRAINT "ux_package_routing_package_tenant";
        END IF;
      END $$;`);

    // Restore legacy unique on package_id if it doesn't exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name='ux_package_routing_package' AND table_name='package_routing'
        ) THEN
          ALTER TABLE "package_routing" ADD CONSTRAINT "ux_package_routing_package" UNIQUE ("package_id");
        END IF;
      END $$;`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_package_routing_tenant`);
    await queryRunner.query(`ALTER TABLE "package_routing" DROP COLUMN IF EXISTS "tenantId"`);
  }
}
