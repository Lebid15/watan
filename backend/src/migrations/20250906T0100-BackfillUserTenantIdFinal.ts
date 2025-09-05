import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Final backfill to eliminate remaining NULL tenantId users after earlier partial migration.
 * Scenario: previous migration file was modified post-deploy and therefore did not re-run (already recorded).
 * This migration re-applies the logic idempotently and enforces NOT NULL + FK (RESTRICT) if possible.
 */
export class BackfillUserTenantIdFinal20250906T0100 implements MigrationInterface {
  name = 'BackfillUserTenantIdFinal20250906T0100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Resolve primary tenant for sham.syrz1.com
    const tenantRows: Array<{ id: string }> = await queryRunner.query(`
      SELECT t.id FROM tenant t
      JOIN tenant_domain d ON d."tenantId"=t.id
      WHERE d.domain = 'sham.syrz1.com' AND d."isPrimary" = true
      LIMIT 1;`);
    if (!tenantRows.length) {
      throw new Error("[MIGRATION][FINAL] Primary tenant for domain 'sham.syrz1.com' not found");
    }
    const tenantId = tenantRows[0].id;

    // 2. Backfill any remaining NULL users
    await queryRunner.query(`UPDATE users SET "tenantId" = $1 WHERE "tenantId" IS NULL`, [tenantId]);

    // 3. Re-check
    const remain: Array<{ id: string }> = await queryRunner.query(`SELECT id FROM users WHERE "tenantId" IS NULL`);
    if (remain.length) {
      const ids = remain.map(r => r.id).join(',');
      throw new Error(`[MIGRATION][FINAL] Still have NULL tenantId users after backfill: ${ids}`);
    }

    // 4. Ensure FK constraint refreshed (drop old if exists) and NOT NULL enforced
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_tenant') THEN
          ALTER TABLE users DROP CONSTRAINT fk_users_tenant;
        END IF;
      END $$;`);

    // Enforce NOT NULL (will succeed because no NULL remain)
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "tenantId" SET NOT NULL;`);

    await queryRunner.query(`ALTER TABLE users
      ADD CONSTRAINT fk_users_tenant FOREIGN KEY ("tenantId") REFERENCES tenant(id) ON DELETE RESTRICT;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert NOT NULL and FK (same as earlier down logic)
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_tenant') THEN
          ALTER TABLE users DROP CONSTRAINT fk_users_tenant;
        END IF;
      END $$;`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "tenantId" DROP NOT NULL;`);
  }
}
