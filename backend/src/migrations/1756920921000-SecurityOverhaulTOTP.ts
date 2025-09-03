import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityOverhaulTOTP1756920921000 implements MigrationInterface {
  name = 'SecurityOverhaulTOTP1756920921000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "mfaRequired" BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS "forceTotpEnroll" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "totpFailedAttempts" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "totpLockedUntil" TIMESTAMPTZ NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "totp_credentials" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "tenantId" UUID NULL,
        "encryptedSecret" VARCHAR(200) NOT NULL,
        "label" VARCHAR(100) NULL,
        "isActive" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMPTZ DEFAULT now(),
        "last_used_at" TIMESTAMPTZ NULL,
        "usageCount" INTEGER DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recovery_codes" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "codeHash" VARCHAR(200) NOT NULL,
        "created_at" TIMESTAMPTZ DEFAULT now(),
        "used_at" TIMESTAMPTZ NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_totp_user" ON "totp_credentials" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_totp_tenant_user" ON "totp_credentials" ("tenantId", "user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_recovery_user" ON "recovery_codes" ("user_id")`);

    await queryRunner.query(`UPDATE "users" SET "forceTotpEnroll" = true WHERE "role" != 'developer'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recovery_codes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "totp_credentials"`);
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "mfaRequired",
      DROP COLUMN IF EXISTS "forceTotpEnroll", 
      DROP COLUMN IF EXISTS "totpFailedAttempts",
      DROP COLUMN IF EXISTS "totpLockedUntil"
    `);
  }
}
