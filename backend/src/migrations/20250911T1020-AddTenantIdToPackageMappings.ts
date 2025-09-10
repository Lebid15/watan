import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantIdToPackageMappings20250911T1020 implements MigrationInterface {
  name = 'AddTenantIdToPackageMappings20250911T1020'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add missing columns if they don't exist
    await queryRunner.query(`ALTER TABLE "package_mappings" ADD COLUMN IF NOT EXISTS "tenantId" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "package_mappings" ADD COLUMN IF NOT EXISTS "meta" jsonb NULL`);

    // Helpful indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_package_mappings_tenant ON "package_mappings" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_package_mappings_api_tenant ON "package_mappings" ("provider_api_id", "tenantId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_package_mappings_api_tenant`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_package_mappings_tenant`);
    await queryRunner.query(`ALTER TABLE "package_mappings" DROP COLUMN IF EXISTS "meta"`);
    await queryRunner.query(`ALTER TABLE "package_mappings" DROP COLUMN IF EXISTS "tenantId"`);
  }
}
