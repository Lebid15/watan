import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ForceFixPackageMappings20250908T1515
 *
 * Production still lacks tenantId/meta on package_mappings despite prior corrective
 * migrations. This consolidated, idempotent migration re-applies the schema changes.
 * Safe to run multiple times; only executes work if columns / indexes missing.
 */
export class ForceFixPackageMappings20250908T1515 implements MigrationInterface {
  name = 'ForceFixPackageMappings20250908T1515';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Ensure table exists
    const tableExists: any[] = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='package_mappings'`
    );
    if (tableExists.length === 0) return; // nothing to do

    // 2) Add tenantId column (nullable first) if missing
    await queryRunner.query(
      `ALTER TABLE package_mappings ADD COLUMN IF NOT EXISTS "tenantId" uuid`
    );

    // 3) Add meta column if missing (jsonb, default '{}')
    await queryRunner.query(
      `ALTER TABLE package_mappings ADD COLUMN IF NOT EXISTS "meta" jsonb DEFAULT '{}'::jsonb`
    );

    // Normalize NULL meta values (in case column existed without default)
    await queryRunner.query(
      `UPDATE package_mappings SET "meta"='{}'::jsonb WHERE "meta" IS NULL`
    );

    // 4) Backfill tenantId from integrations if missing
    await queryRunner.query(`
      UPDATE package_mappings pm
      SET "tenantId" = i."tenantId"
      FROM integrations i
      WHERE pm.provider_api_id ~ '^[0-9a-fA-F-]{36}$'
        AND pm.provider_api_id::uuid = i.id
        AND pm."tenantId" IS NULL
    `);

    // 5) If no null tenantId remain, enforce NOT NULL
    const nulls: any[] = await queryRunner.query(
      `SELECT COUNT(*)::int AS cnt FROM package_mappings WHERE "tenantId" IS NULL`
    );
    const remaining = Number(nulls?.[0]?.cnt || 0);
    if (remaining === 0) {
      try {
        await queryRunner.query(
          `ALTER TABLE package_mappings ALTER COLUMN "tenantId" SET NOT NULL`
        );
      } catch {
        // ignore (lock or concurrent migration); will tighten later manually
      }
    }

    // 6) Create indexes if missing
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_package_mappings_tenant_api ON package_mappings ("tenantId", provider_api_id)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_package_mappings_tenant_package ON package_mappings ("tenantId", our_package_id)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only drop what we created; remain idempotent / forgiving
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_package_mappings_tenant_package`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_package_mappings_tenant_api`
    );
    await queryRunner.query(
      `ALTER TABLE package_mappings DROP COLUMN IF EXISTS "meta"`
    );
    await queryRunner.query(
      `ALTER TABLE package_mappings DROP COLUMN IF EXISTS "tenantId"`
    );
  }
}
