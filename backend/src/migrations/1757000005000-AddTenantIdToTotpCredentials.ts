import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Some environments already had an early version of the "totp_credentials" table
 * without the "tenantId" column (because the SecurityOverhaul migration used
 * CREATE TABLE IF NOT EXISTS and therefore did not add the new column if the table pre-existed).
 * This migration safely adds the missing column and composite index.
 */
export class AddTenantIdToTotpCredentials1757000005000 implements MigrationInterface {
  name = 'AddTenantIdToTotpCredentials1757000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the column if it's missing
    await queryRunner.query(`ALTER TABLE "totp_credentials" ADD COLUMN IF NOT EXISTS "tenantId" UUID NULL`);
    // Create the composite index (will be a no-op if it already exists)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_totp_tenant_user" ON "totp_credentials" ("tenantId", "user_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first (ignore if already gone)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_totp_tenant_user"`);
    // Drop the column (only if exists to stay idempotent on partial rollbacks)
    await queryRunner.query(`ALTER TABLE "totp_credentials" DROP COLUMN IF EXISTS "tenantId"`);
  }
}
