import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds missing multi-tenant columns (tenantId) to legacy tables that were created
 * before multi-tenant refactor: payment_method, deposit, code_group.
 * Backfills all existing rows with the primary tenant ID (provided via env FALLBACK_TENANT_ID
 * or hard-coded fallback) so current data remains visible to that tenant.
 */
export class AddTenantColumns20250829152000 implements MigrationInterface {
  name = 'AddTenantColumns20250829152000';

  private fallbackTenantId = process.env.FALLBACK_TENANT_ID || 'f280a88c-ec11-4a93-b1d6-d041bb279663';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // payment_method
    await queryRunner.query(`ALTER TABLE "payment_method" ADD COLUMN IF NOT EXISTS "tenantId" uuid`);
    await queryRunner.query(`UPDATE "payment_method" SET "tenantId"='${this.fallbackTenantId}' WHERE "tenantId" IS NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_method_tenant" ON "payment_method" ("tenantId")`);
    // unique (tenantId,name) ensure no cross-tenant conflict; ignore if already there
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'UX_payment_method_tenant_name'
      ) THEN
        CREATE UNIQUE INDEX "UX_payment_method_tenant_name" ON "payment_method" ("tenantId", "name");
      END IF;
    END $$;`);

    // deposit
    await queryRunner.query(`ALTER TABLE "deposit" ADD COLUMN IF NOT EXISTS "tenantId" uuid`);
    await queryRunner.query(`UPDATE "deposit" SET "tenantId"='${this.fallbackTenantId}' WHERE "tenantId" IS NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_tenant" ON "deposit" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_tenant_status_created" ON "deposit" ("tenantId","status","createdAt")`);

    // code_group
    await queryRunner.query(`ALTER TABLE "code_group" ADD COLUMN IF NOT EXISTS "tenantId" uuid`);
    await queryRunner.query(`UPDATE "code_group" SET "tenantId"='${this.fallbackTenantId}' WHERE "tenantId" IS NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_code_group_tenant" ON "code_group" ("tenantId")`);
    // Replace unique(publicCode) with unique(tenantId, publicCode)
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='IDX_code_group_publicCode') THEN
        DROP INDEX IF EXISTS "IDX_code_group_publicCode";
      END IF;
    END $$;`);
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ux_code_group_public_code_tenant') THEN
        CREATE UNIQUE INDEX "ux_code_group_public_code_tenant" ON "code_group" ("tenantId", "publicCode");
      END IF;
    END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort revert: keep data but drop indexes; do not drop tenantId columns to avoid data loss for new code.
    await queryRunner.query(`DROP INDEX IF EXISTS "UX_payment_method_tenant_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payment_method_tenant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_deposit_tenant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_deposit_tenant_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_code_group_tenant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_code_group_public_code_tenant"`);
  // Note: We intentionally do NOT drop the tenantId columns to avoid data loss for code relying on them.
  }
}
