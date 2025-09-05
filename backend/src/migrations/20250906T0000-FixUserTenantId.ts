import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration steps:
 * Revised:
 * 1. Resolve target tenantId using the known primary domain 'sham.syrz1.com'.
 * 2. Backfill ALL users with NULL tenantId to that tenant (idempotent: only rows where tenantId IS NULL).
 * 3. Re-check: if any NULL remain -> throw error with list of IDs (fail migration).
 * 4. Enforce NOT NULL and FK ON DELETE RESTRICT.
 */
export class FixUserTenantId20250906T0000 implements MigrationInterface {
  name = 'FixUserTenantId20250906T0000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Determine tenantId for primary domain 'sham.syrz1.com'
    const tenantRow: Array<{ id: string }> = await queryRunner.query(`
      SELECT t.id FROM tenant t
      JOIN tenant_domain d ON d."tenantId" = t.id
      WHERE d.domain = 'sham.syrz1.com' AND d."isPrimary" = true
      LIMIT 1;
    `);
    if (!tenantRow.length) {
      throw new Error("[MIGRATION] Cannot locate tenant for primary domain 'sham.syrz1.com'");
    }
    const targetTenantId = tenantRow[0].id;

    // 2. Backfill users with NULL tenantId
    await queryRunner.query(
      `UPDATE users SET "tenantId" = $1 WHERE "tenantId" IS NULL`,
      [targetTenantId]
    );

    // 3. Re-check for any remaining NULL users; if any -> fail fast.
    const remainingUsers: Array<{ id: string }> = await queryRunner.query(`SELECT id FROM users WHERE "tenantId" IS NULL`);
    if (remainingUsers.length) {
      const ids = remainingUsers.map(r => r.id).join(',');
      throw new Error(`[MIGRATION] Unable to backfill tenantId for users: ${ids}`);
    }

    // 4. Enforce NOT NULL + FK ON DELETE RESTRICT (drop existing FK if exists)
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_tenant') THEN
          ALTER TABLE users DROP CONSTRAINT fk_users_tenant;
        END IF;
      END $$;`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "tenantId" SET NOT NULL;`);
    await queryRunner.query(`ALTER TABLE users
      ADD CONSTRAINT fk_users_tenant FOREIGN KEY ("tenantId") REFERENCES tenant(id) ON DELETE RESTRICT;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: drop FK, make column nullable again
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_tenant') THEN
          ALTER TABLE users DROP CONSTRAINT fk_users_tenant;
        END IF;
      END $$;`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "tenantId" DROP NOT NULL;`);
  }
}
