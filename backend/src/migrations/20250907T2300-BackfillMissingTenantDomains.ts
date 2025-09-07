import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BackfillMissingTenantDomains
 * Inserts a primary verified subdomain <code>.<PUBLIC_TENANT_BASE_DOMAIN> for any tenant
 * that currently has ZERO rows in tenant_domain.
 * Safe + idempotent: skips if tenant_domain table missing or already has rows per tenant.
 */
export class BackfillMissingTenantDomains20250907T2300 implements MigrationInterface {
  name = 'BackfillMissingTenantDomains20250907T2300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTenant = await queryRunner.hasTable('tenant');
    const hasDomain = await queryRunner.hasTable('tenant_domain');
    if (!hasTenant || !hasDomain) return;

    const base = (process.env.PUBLIC_TENANT_BASE_DOMAIN || 'localhost').toLowerCase();

    // Find tenants without any domain rows
    const tenants: { id: string; code: string }[] = await queryRunner.query(`
      SELECT t.id, t.code
      FROM tenant t
      LEFT JOIN tenant_domain d ON d.tenant_id = t.id
      GROUP BY t.id
      HAVING COUNT(d.id) = 0
    `);

    for (const t of tenants) {
      const domain = `${t.code}.${base}`;
      await queryRunner.query(
        `INSERT INTO tenant_domain (id, tenant_id, domain, type, is_primary, is_verified, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'subdomain', true, true, NOW(), NOW())
         ON CONFLICT DO NOTHING` as any,
        [t.id, domain],
      );
      // Clear other primaries just in case (though none should exist)
      await queryRunner.query(
        `UPDATE tenant_domain SET is_primary = false WHERE tenant_id = $1 AND domain != $2 AND is_primary = true`,
        [t.id, domain],
      );
    }
  }

  public async down(): Promise<void> {
    // Non destructive rollback (no-op) to avoid removing domains in use
    return;
  }
}
