import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fallback backfill for lingering NULL users. Robust multi-step strategy:
 * 1. If no NULL tenantId users -> noop.
 * 2. Try to resolve target tenant (priority order):
 *    a) Primary domain 'sham.syrz1.com'
 *    b) Any tenant with a primary domain (lowest createdAt)
 * 3. Assign all NULL users to that tenantId.
 * 4. Re-check -> if any remain NULL throw error.
 * 5. (If earlier migrations missed FK/NOT NULL) attempt to enforce again safely.
 */
export class BackfillUserTenantIdFallback20250906T0115 implements MigrationInterface {
  name = 'BackfillUserTenantIdFallback20250906T0115';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const nullUsers: Array<{ id: string; email: string }> = await queryRunner.query(`SELECT id, email FROM users WHERE "tenantId" IS NULL`);
    if (!nullUsers.length) {
      return; // nothing to do
    }

    // Determine target tenant (dynamic primary sham.<baseDomain>)
    const base = (process.env.PUBLIC_TENANT_BASE_DOMAIN || 'example.com').trim().toLowerCase();
    const desired = `sham.${base}`;
    let targetTenant: Array<{ id: string }> = await queryRunner.query(`
      SELECT t.id FROM tenant t
      JOIN tenant_domain d ON d."tenantId"=t.id
      WHERE d.domain=$1 AND d."isPrimary"=true
      LIMIT 1;`, [desired]);

    if (!targetTenant.length) {
      targetTenant = await queryRunner.query(`
        SELECT t.id FROM tenant t
        JOIN tenant_domain d ON d."tenantId"=t.id AND d."isPrimary"=true
        ORDER BY t."createdAt" ASC NULLS LAST
        LIMIT 1;`);
    }

    if (!targetTenant.length) {
      // As a last resort create a default tenant + primary domain so we can proceed.
      const newTenantId = (await queryRunner.query(`SELECT gen_random_uuid() as id`))[0].id;
      await queryRunner.query(`INSERT INTO tenant (id, name, code, "ownerUserId", "isActive") VALUES ($1, 'Sham', 'sham', NULL, true)`, [newTenantId]);
      await queryRunner.query(`INSERT INTO tenant_domain (id, "tenantId", domain, type, "isPrimary", "isVerified") VALUES (gen_random_uuid(), $1, $2, 'subdomain', true, true)`, [newTenantId, desired]);
      targetTenant = [{ id: newTenantId }];
    }
    const tenantId = targetTenant[0].id;

    // Log affected users before update
    console.log(`[MIGRATION][FALLBACK] Backfilling ${nullUsers.length} users -> tenantId ${tenantId}`);
    console.log('[MIGRATION][FALLBACK] Users:', nullUsers.map(u => `${u.id}:${u.email}`).join(','));

    await queryRunner.query(`UPDATE users SET "tenantId" = $1 WHERE "tenantId" IS NULL`, [tenantId]);

    const remain: Array<{ id: string }> = await queryRunner.query(`SELECT id FROM users WHERE "tenantId" IS NULL`);
    if (remain.length) {
      const ids = remain.map(r => r.id).join(',');
      throw new Error(`[MIGRATION][FALLBACK] Still NULL after backfill: ${ids}`);
    }

    // Attempt to ensure constraints again (idempotent)
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_tenant') THEN
        ALTER TABLE users DROP CONSTRAINT fk_users_tenant;
      END IF;
    END $$;`);

    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "tenantId" SET NOT NULL;`);
    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT fk_users_tenant FOREIGN KEY ("tenantId") REFERENCES tenant(id) ON DELETE RESTRICT;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Do not revert assignment; only relax constraint if needed
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_tenant') THEN
        ALTER TABLE users DROP CONSTRAINT fk_users_tenant;
      END IF;
    END $$;`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN "tenantId" DROP NOT NULL;`);
  }
}
