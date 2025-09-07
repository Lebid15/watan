import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration steps:
 * Revised:
 * 1. Resolve target tenantId using dynamic primary domain sham.<PUBLIC_TENANT_BASE_DOMAIN>.
 * 2. Backfill ALL users with NULL tenantId to that tenant (idempotent: only rows where tenantId IS NULL).
 * 3. Re-check: if any NULL remain -> throw error with list of IDs (fail migration).
 * 4. Enforce NOT NULL and FK ON DELETE RESTRICT.
 */
export class FixUserTenantId20250906T0000 implements MigrationInterface {
  name = 'FixUserTenantId20250906T0000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard: skip if core tables not yet present
    const tables = await queryRunner.query(`SELECT table_name FROM information_schema.tables WHERE table_name IN ('users','tenant','tenant_domain')`);
    const haveUsers = tables.some((r: any) => r.table_name === 'users');
    const haveTenant = tables.some((r: any) => r.table_name === 'tenant');
    const haveTenantDomain = tables.some((r: any) => r.table_name === 'tenant_domain');
    if (!haveUsers || !haveTenant || !haveTenantDomain) {
      console.log('[Migration][FixUserTenantId] Skipping (core tables missing).');
      return;
    }
    const base = (process.env.PUBLIC_TENANT_BASE_DOMAIN || 'example.com').trim().toLowerCase();
    const primaryDomain = `sham.${base}`;
    // Find or create tenant + domain
    let row: Array<{ id: string }> = await queryRunner.query(`
      SELECT t.id FROM tenant t JOIN tenant_domain d ON d."tenantId"=t.id
      WHERE d.domain=$1 AND d."isPrimary"=true LIMIT 1;`, [primaryDomain]);
    if (!row.length) {
      // Create minimal tenant if nothing exists
      const existingAny: Array<{ id: string }> = await queryRunner.query(`SELECT id FROM tenant ORDER BY "createdAt" ASC LIMIT 1;`);
      let tid: string;
      if (existingAny.length) {
        tid = existingAny[0].id;
        // Ensure domain row
        await queryRunner.query(`INSERT INTO tenant_domain (id, "tenantId", domain, type, "isPrimary", "isVerified")
          VALUES (gen_random_uuid(), $1, $2, 'subdomain', true, true) ON CONFLICT (domain) DO NOTHING;`, [tid, primaryDomain]);
      } else {
        tid = (await queryRunner.query(`SELECT gen_random_uuid() as id`))[0].id;
        await queryRunner.query(`INSERT INTO tenant (id, name, code, "ownerUserId", "isActive") VALUES ($1,'Sham','sham',NULL,true)`, [tid]);
        await queryRunner.query(`INSERT INTO tenant_domain (id, "tenantId", domain, type, "isPrimary", "isVerified")
          VALUES (gen_random_uuid(), $1, $2, 'subdomain', true, true)`, [tid, primaryDomain]);
      }
      row = await queryRunner.query(`SELECT t.id FROM tenant t JOIN tenant_domain d ON d."tenantId"=t.id WHERE d.domain=$1 AND d."isPrimary"=true LIMIT 1;`, [primaryDomain]);
    }
    if (!row.length) {
      console.log('[Migration][FixUserTenantId] Unable to establish primary tenant, skipping backfill.');
      return; // soft skip instead of throwing to keep container healthy on pristine DB
    }
    const targetTenantId = row[0].id;

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
