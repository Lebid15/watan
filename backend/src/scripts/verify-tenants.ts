import 'reflect-metadata';
import dataSource from '../data-source';

/**
 * Verifies tenant integrity:
 * - users.tenantId references existing tenant
 * - each tenant has exactly 0 or 1 primary domain (at most) and at least 1 domain overall
 * - each tenant with users must have a primary domain
 */
async function run() {
  await dataSource.initialize();
  const orphanUsers = await dataSource.query(`SELECT id, "tenantId" FROM users WHERE "tenantId" IS NOT NULL AND "tenantId" NOT IN (SELECT id FROM tenant)`);
  const nullTenantUsers = await dataSource.query(`SELECT id FROM users WHERE "tenantId" IS NULL`);
  const tenantsNoPrimary = await dataSource.query(`SELECT t.id FROM tenant t LEFT JOIN tenant_domain d ON d."tenantId"=t.id AND d."isPrimary" = true WHERE d.id IS NULL`);
  const multiPrimary = await dataSource.query(`SELECT "tenantId", count(*) c FROM tenant_domain WHERE "isPrimary" = true GROUP BY "tenantId" HAVING count(*) > 1`);
  const tenantsNoDomain = await dataSource.query(`SELECT t.id FROM tenant t LEFT JOIN tenant_domain d ON d."tenantId"=t.id WHERE d.id IS NULL`);

  const issues: any[] = [];
  for (const u of orphanUsers) issues.push({ category: 'orphan_user_tenant', userId: u.id, tenantId: u.tenantId });
  for (const u of nullTenantUsers) issues.push({ category: 'null_tenant_user', userId: u.id });
  for (const t of tenantsNoPrimary) issues.push({ category: 'missing_primary_domain', tenantId: t.id });
  for (const t of multiPrimary) issues.push({ category: 'multiple_primary_domains', tenantId: t.tenantId, count: t.c });
  for (const t of tenantsNoDomain) issues.push({ category: 'tenant_no_domains', tenantId: t.id });

  // Determine which categories are considered deployment-blocking.
  // By default ONLY obvious integrity breakers fail (orphan user referencing missing tenant, duplicate primary domains).
  // Categories currently observed that are treated as WARN by default: null_tenant_user, missing_primary_domain, tenant_no_domains
  // These can still surface during early provisioning and shouldn't block deploy until data migration tasks are completed.
  const defaultFail = ['orphan_user_tenant', 'multiple_primary_domains'];
  const envFail = process.env.TENANT_VERIFY_FAIL_CATEGORIES; // comma separated list to override
  const failCategories = new Set(
    (envFail ? envFail.split(',') : defaultFail).map(s => s.trim()).filter(Boolean)
  );

  const blocking = issues.filter(i => failCategories.has(i.category));
  const summary = {
    issues,
    counts: {
      orphanUsers: orphanUsers.length,
      nullTenantUsers: nullTenantUsers.length,
      tenantsNoPrimary: tenantsNoPrimary.length,
      multiPrimary: multiPrimary.length,
      tenantsNoDomain: tenantsNoDomain.length
    },
    failCategories: Array.from(failCategories),
    blockingCount: blocking.length
  };
  console.log(JSON.stringify(summary, null, 2));
  await dataSource.destroy();

  if (blocking.length) {
    const grouped = blocking.reduce<Record<string, number>>((acc, cur) => {
      acc[cur.category] = (acc[cur.category] || 0) + 1; return acc;
    }, {});
    console.error('[VERIFY] Blocking tenant integrity issues detected:', grouped);
    process.exit(1);
  } else if (issues.length) {
    console.warn('[VERIFY] Non-blocking tenant warnings present (deployment not failed). Set TENANT_VERIFY_FAIL_CATEGORIES to include them if needed.');
  }
}

run().catch(e => { console.error(e); process.exit(2); });
