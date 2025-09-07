import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Final backfill to eliminate remaining NULL tenantId users after earlier partial migration.
 * Scenario: previous migration file was modified post-deploy and therefore did not re-run (already recorded).
 * This migration re-applies the logic idempotently and enforces NOT NULL + FK (RESTRICT) if possible.
 */
export class BackfillUserTenantIdFinal20250906T0100 implements MigrationInterface {
  name = 'BackfillUserTenantIdFinal20250906T0100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Skip entirely if core tables not yet created (fresh DB scenario). This makes the migration idempotent & safe.
    const tablesExist = await queryRunner.query(`SELECT table_name FROM information_schema.tables WHERE table_name IN ('users','tenant','tenant_domain')`);
    const haveUsers = tablesExist.some((r: any) => r.table_name === 'users');
    const haveTenant = tablesExist.some((r: any) => r.table_name === 'tenant');
    const haveTenantDomain = tablesExist.some((r: any) => r.table_name === 'tenant_domain');
    if (!haveUsers || !haveTenant || !haveTenantDomain) {
      console.log('[Migration][FINAL] Skipping backfill (required tables missing yet).');
      return; // Wait until schema established in environments where ordering/glob differences occur.
    }
    // Derive base domain (fallback to env PUBLIC_TENANT_BASE_DOMAIN or 'example.com')
    const base = (process.env.PUBLIC_TENANT_BASE_DOMAIN || 'example.com').trim().toLowerCase();
    const primaryDomain = `sham.${base}`;

    // Ensure tenant & primary domain exist (idempotent). Try to find existing primary first.
    let tenantRow: Array<{ id: string }> = await queryRunner.query(`
      SELECT t.id FROM tenant t
      JOIN tenant_domain d ON d."tenantId"=t.id
      WHERE d.domain = $1 AND d."isPrimary"=true
      LIMIT 1;`, [primaryDomain]);

    if (!tenantRow.length) {
      // No primary for sham.<base>. Create tenant if entirely missing.
      // Attempt to find any tenant to reuse (old logic) else create new.
      let newTenantId: string | null = null;
      const existingAny: Array<{ id: string }> = await queryRunner.query(`SELECT id FROM tenant ORDER BY "createdAt" ASC LIMIT 1;`);
      if (existingAny.length) {
        newTenantId = existingAny[0].id;
        // Check if that tenant already has a primary domain; if not, add ours as primary.
        const hasPrimary: Array<{ id: string }> = await queryRunner.query(`
          SELECT d.id FROM tenant_domain d WHERE d."tenantId"=$1 AND d."isPrimary"=true LIMIT 1;`, [newTenantId]);
        if (!hasPrimary.length) {
          await queryRunner.query(`INSERT INTO tenant_domain (id, "tenantId", domain, type, "isPrimary", "isVerified")
            VALUES (gen_random_uuid(), $1, $2, 'subdomain', true, true)
            ON CONFLICT (domain) DO NOTHING;`, [newTenantId, primaryDomain]);
        } else {
          // If a primary exists but it's different, also insert ours as non-primary (skip making two primaries).
          await queryRunner.query(`INSERT INTO tenant_domain (id, "tenantId", domain, type, "isPrimary", "isVerified")
            VALUES (gen_random_uuid(), $1, $2, 'subdomain', false, true)
            ON CONFLICT (domain) DO NOTHING;`, [newTenantId, primaryDomain]);
        }
      } else {
        // No tenants at all -> create a default.
        newTenantId = (await queryRunner.query(`SELECT gen_random_uuid() as id`))[0].id;
        await queryRunner.query(`INSERT INTO tenant (id, name, code, "ownerUserId", "isActive") VALUES ($1, 'Sham', 'sham', NULL, true)`, [newTenantId]);
        await queryRunner.query(`INSERT INTO tenant_domain (id, "tenantId", domain, type, "isPrimary", "isVerified")
          VALUES (gen_random_uuid(), $1, $2, 'subdomain', true, true)`, [newTenantId, primaryDomain]);
      }
      // Re-select to set tenantRow
      tenantRow = await queryRunner.query(`
        SELECT t.id FROM tenant t
        JOIN tenant_domain d ON d."tenantId"=t.id
        WHERE d.domain = $1 AND d."isPrimary"=true
        LIMIT 1;`, [primaryDomain]);
    }

    if (!tenantRow.length) {
      throw new Error(`[MIGRATION][FINAL] Could not establish primary tenant for domain ${primaryDomain}`);
    }
    const tenantId = tenantRow[0].id;

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
    // Make NOT NULL only if all rows have tenantId (idempotent safety)
    const nullCheck: Array<{ c: number }> = await queryRunner.query(`SELECT count(*)::int as c FROM users WHERE "tenantId" IS NULL`);
    if (nullCheck[0].c === 0) {
      await queryRunner.query(`ALTER TABLE users ALTER COLUMN "tenantId" SET NOT NULL;`);
    }
    // Add FK if missing
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_tenant') THEN
        ALTER TABLE users ADD CONSTRAINT fk_users_tenant FOREIGN KEY ("tenantId") REFERENCES tenant(id) ON DELETE RESTRICT;
      END IF;
    END $$;`);
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
