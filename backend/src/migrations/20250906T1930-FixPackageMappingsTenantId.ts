import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrective migration: previous migration recorded as applied but column "tenantId" missing on package_mappings.
 * Idempotent: uses IF NOT EXISTS and guards; safe to run multiple times.
 */
export class FixPackageMappingsTenantId20250906T1930 implements MigrationInterface {
  name = 'FixPackageMappingsTenantId20250906T1930';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Ensure table exists
    const rows: any[] = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='package_mappings'`
    );
    if (rows.length === 0) {
      // Nothing to do (do NOT create the table here; original migration should handle schema creation)
      return;
    }

    // 2) Add tenantId column if missing (nullable first to allow backfill)
    await queryRunner.query(
      `ALTER TABLE package_mappings ADD COLUMN IF NOT EXISTS "tenantId" uuid`
    );

    // 3) Backfill from integrations table where provider_api_id matches integration id (UUID)
    await queryRunner.query(`
      UPDATE package_mappings pm
      SET "tenantId" = i."tenantId"
      FROM integrations i
      WHERE pm.provider_api_id ~ '^[0-9a-fA-F-]{36}$'
        AND pm.provider_api_id::uuid = i.id
        AND pm."tenantId" IS NULL
    `);

    // (Optional) If all rows now have tenantId, enforce NOT NULL
    const nullCountResult: any[] = await queryRunner.query(
      `SELECT COUNT(*)::int AS cnt FROM package_mappings WHERE "tenantId" IS NULL`
    );
    const nulls = Number(nullCountResult?.[0]?.cnt || 0);
    if (nulls === 0) {
      try {
        await queryRunner.query(
          `ALTER TABLE package_mappings ALTER COLUMN "tenantId" SET NOT NULL`
        );
      } catch (_) {
        /* ignore if cannot alter (e.g., concurrent lock) */
      }
    }

    // 4) Create indexes if missing
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_package_mappings_tenant_api ON package_mappings ("tenantId", provider_api_id)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_package_mappings_tenant_package ON package_mappings ("tenantId", our_package_id)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: drop indexes then column (all IF EXISTS)
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_package_mappings_tenant_package`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_package_mappings_tenant_api`
    );
    await queryRunner.query(
      `ALTER TABLE package_mappings DROP COLUMN IF EXISTS "tenantId"`
    );
  }
}
