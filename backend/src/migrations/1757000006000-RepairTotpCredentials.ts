import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repairs legacy "totp_credentials" structure (old columns: secret, updated_at, missing tenantId etc.)
 * to match current entity expectations (encryptedSecret, tenantId, label, last_used_at, usageCount).
 * All operations are idempotent and safe to re-run.
 */
export class RepairTotpCredentials1757000006000 implements MigrationInterface {
  name = 'RepairTotpCredentials1757000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename legacy secret -> encryptedSecret if needed
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='totp_credentials' AND column_name='secret'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='totp_credentials' AND column_name='encryptedSecret'
      ) THEN
        EXECUTE 'ALTER TABLE "totp_credentials" RENAME COLUMN "secret" TO "encryptedSecret"';
      END IF;
    END$$;`);

    // Add new columns if missing
    await queryRunner.query(`ALTER TABLE "totp_credentials" ADD COLUMN IF NOT EXISTS "tenantId" UUID NULL`);
    await queryRunner.query(`ALTER TABLE "totp_credentials" ADD COLUMN IF NOT EXISTS "label" VARCHAR(100) NULL`);
    await queryRunner.query(`ALTER TABLE "totp_credentials" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ NULL`);
    await queryRunner.query(`ALTER TABLE "totp_credentials" ADD COLUMN IF NOT EXISTS "usageCount" INTEGER DEFAULT 0`);

    // Ensure indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_totp_user" ON "totp_credentials" ("user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_totp_tenant_user" ON "totp_credentials" ("tenantId", "user_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non-destructive rollback: just drop columns we added (keep rename intact to avoid data loss)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_totp_tenant_user"`);
    // Leave idx_totp_user (harmless) and encryptedSecret column.
    await queryRunner.query(`ALTER TABLE "totp_credentials" DROP COLUMN IF EXISTS "usageCount"`);
    await queryRunner.query(`ALTER TABLE "totp_credentials" DROP COLUMN IF EXISTS "last_used_at"`);
    await queryRunner.query(`ALTER TABLE "totp_credentials" DROP COLUMN IF EXISTS "label"`);
    await queryRunner.query(`ALTER TABLE "totp_credentials" DROP COLUMN IF EXISTS "tenantId"`);
  }
}
