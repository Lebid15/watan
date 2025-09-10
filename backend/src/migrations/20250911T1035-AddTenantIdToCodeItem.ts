import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensure multi-tenant support for code_item by adding tenantId and backfilling
 * from the parent code_group. Also adds helpful indexes.
 */
export class AddTenantIdToCodeItem20250911T1035 implements MigrationInterface {
  name = 'AddTenantIdToCodeItem20250911T1035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add column if missing
    await queryRunner.query(`ALTER TABLE "code_item" ADD COLUMN IF NOT EXISTS "tenantId" uuid`);

    // Backfill from group.tenantId where null
    await queryRunner.query(`
      UPDATE "code_item" ci
      SET "tenantId" = cg."tenantId"
      FROM "code_group" cg
      WHERE ci."tenantId" IS NULL AND ci."groupId" = cg."id";
    `);

    // If any still null (shouldn't), fallback to a default if provided via env (best-effort)
    const fallback = process.env.FALLBACK_TENANT_ID || null;
    if (fallback) {
      await queryRunner.query(`UPDATE "code_item" SET "tenantId"='${fallback}' WHERE "tenantId" IS NULL`);
    }

    // Enforce NOT NULL after backfill
    await queryRunner.query(`ALTER TABLE "code_item" ALTER COLUMN "tenantId" SET NOT NULL`);

    // Indexes for performance
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_code_item_tenant" ON "code_item" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_code_item_tenant_group" ON "code_item" ("tenantId","groupId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_code_item_tenant_group"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_code_item_tenant"`);
    // Keep tenantId column to avoid breaking code; best-effort drop NOT NULL only
    await queryRunner.query(`ALTER TABLE "code_item" ALTER COLUMN "tenantId" DROP NOT NULL`);
    // Do not drop the column to prevent data loss in down migrations
  }
}
