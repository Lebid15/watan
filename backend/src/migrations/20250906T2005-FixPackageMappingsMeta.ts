import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrective migration: ensure package_mappings has jsonb column "meta".
 * Idempotent (IF NOT EXISTS). Adds column with default '{}'.
 */
export class FixPackageMappingsMeta20250906T2005 implements MigrationInterface {
  name = 'FixPackageMappingsMeta20250906T2005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure table exists first
    const exists: any[] = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='package_mappings'`
    );
    if (exists.length === 0) return; // nothing to do

    // Add column if missing (DEFAULT '{}'::jsonb). Existing rows get default.
    await queryRunner.query(
      `ALTER TABLE package_mappings ADD COLUMN IF NOT EXISTS "meta" jsonb DEFAULT '{}'::jsonb`
    );

    // Normalize any NULLs (in case column existed without default)
    await queryRunner.query(
      `UPDATE package_mappings SET "meta"='{}'::jsonb WHERE "meta" IS NULL`
    );

    // (Optional) enforce NOT NULL if desired (commented out per request)
    // await queryRunner.query(`ALTER TABLE package_mappings ALTER COLUMN "meta" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE package_mappings DROP COLUMN IF EXISTS "meta"`
    );
  }
}
