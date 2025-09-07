import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures a default tenant exists and assigns any orphan users/products/packages to it.
 * Table naming note: runtime entity maps to 'tenant' (singular) but earlier rescue migrations created 'tenants'.
 * We handle both by checking which table exists. Preference: if 'tenant' exists use it; else fallback to 'tenants'.
 */
export class SeedDefaultTenant20250907T1100 implements MigrationInterface {
  name = 'SeedDefaultTenant20250907T1100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Detect actual tenant table name
    const tblRow: any[] = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name in ('tenant','tenants') ORDER BY CASE WHEN table_name='tenant' THEN 0 ELSE 1 END LIMIT 1
    `);
    if (!tblRow.length) throw new Error('No tenant/tenants table found');
    const tenantTable = tblRow[0].table_name;

    // Ensure code uniqueness
    const code = 'default';
    const existing: any[] = await queryRunner.query(`SELECT id FROM ${tenantTable} WHERE code = $1 LIMIT 1`, [code]);
    let tenantId: string;
    if (existing.length) {
      tenantId = existing[0].id;
    } else {
      const inserted: any[] = await queryRunner.query(`
        INSERT INTO ${tenantTable} (id, name, code, "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), 'Default Tenant', $1, true, now(), now()) RETURNING id
      `, [code]);
      tenantId = inserted[0].id;
      console.log('[MIGRATION] Created default tenant id=' + tenantId);
    }

    // Attach orphan users (tenantId is null)
    try {
      await queryRunner.query(`UPDATE users SET "tenantId" = $1 WHERE "tenantId" IS NULL`, [tenantId]);
    } catch (e:any) {
      console.warn('[MIGRATION] Skipping orphan users attach:', e.message);
    }

    // Attach orphan products (tenantId null or invalid)
    try {
      await queryRunner.query(`UPDATE product SET "tenantId" = $1 WHERE ("tenantId" IS NULL OR NOT EXISTS (SELECT 1 FROM ${tenantTable} t WHERE t.id = product."tenantId"))`, [tenantId]);
    } catch (e:any) {
      console.warn('[MIGRATION] Skipping orphan products attach:', e.message);
    }

    // Attach orphan packages referencing products now fixed
    try {
      await queryRunner.query(`
        UPDATE product_package pp
        SET "tenantId" = p."tenantId"
        FROM product p
        WHERE pp."tenantId" IS NULL AND pp."productId" = p.id
      `);
    } catch (e:any) {
      console.warn('[MIGRATION] Skipping orphan packages tenant sync:', e.message);
    }

    // Attach orphan orders (tenantId null) — risk: cross-tenant mixing; only fill nulls
    try {
      await queryRunner.query(`UPDATE product_orders SET "tenantId" = $1 WHERE "tenantId" IS NULL`, [tenantId]);
    } catch (e:any) {
      console.warn('[MIGRATION] Skipping orphan orders attach:', e.message);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // We do NOT delete tenant or revert assignments to avoid data loss.
    console.log('[MIGRATION] SeedDefaultTenant down: no action (non destructive).');
  }
}
