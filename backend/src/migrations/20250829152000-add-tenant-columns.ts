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
    const paymentMethodTableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name='payment_method'
    `);
    
    if (paymentMethodTableExists.length > 0) {
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
    } else {
      console.log('AddTenantColumns: payment_method table does not exist, skipping');
    }

    // deposit
    const depositTableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name='deposit'
    `);
    
    if (depositTableExists.length > 0) {
      await queryRunner.query(`ALTER TABLE "deposit" ADD COLUMN IF NOT EXISTS "tenantId" uuid`);
      await queryRunner.query(`UPDATE "deposit" SET "tenantId"='${this.fallbackTenantId}' WHERE "tenantId" IS NULL`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_tenant" ON "deposit" ("tenantId")`);
      
      const hasCreatedAt = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns WHERE table_name='deposit' AND column_name='createdAt'
      `);
      const hasCreated_at = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns WHERE table_name='deposit' AND column_name='created_at'
      `);
      
      if (hasCreatedAt.length > 0) {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_tenant_status_created" ON "deposit" ("tenantId","status","createdAt")`);
      } else if (hasCreated_at.length > 0) {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deposit_tenant_status_created" ON "deposit" ("tenantId","status","created_at")`);
      } else {
        console.log('AddTenantColumns: No createdAt or created_at column found in deposit table, skipping index creation');
      }
    } else {
      console.log('AddTenantColumns: deposit table does not exist, skipping');
    }

    // code_group
    const codeGroupTableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name='code_group'
    `);
    
    if (codeGroupTableExists.length > 0) {
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
    } else {
      console.log('AddTenantColumns: code_group table does not exist, skipping');
    }
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
