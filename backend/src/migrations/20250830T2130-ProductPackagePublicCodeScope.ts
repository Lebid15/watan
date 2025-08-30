import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adjust uniqueness of product_packages.publicCode from (tenantId, publicCode)
 * to (product_id, publicCode). Also: delete legacy catalog imported products
 * whose ALL packages have providerName IS NOT NULL.
 * A simple JSON backup of affected products is written to a temp table then selectable.
 */
export class ProductPackagePublicCodeScope20250830T2130 implements MigrationInterface {
  name = 'ProductPackagePublicCodeScope20250830T2130';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop old unique index if exists
    try { await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_tenant_public_code"`); } catch {}

    // 2. Create new unique index on (product_id, publicCode)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_product_packages_product_public_code" ON "product_packages" ("product_id", "publicCode") WHERE publicCode IS NOT NULL`);

    // 3. Backup + delete catalog-imported products (all packages providerName NOT NULL)
    // Create a temporary table for backup (persisting in DB for manual retrieval)
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS _backup_removed_products_20250830 AS SELECT p.*, datetime('now') as removedAt FROM product p WHERE 1=0`);

    // Find products where every package has providerName IS NOT NULL and at least one package exists
    const rows: any[] = await queryRunner.query(`SELECT p.id FROM product p WHERE EXISTS (SELECT 1 FROM product_packages pk WHERE pk.product_id = p.id) AND NOT EXISTS (SELECT 1 FROM product_packages pk2 WHERE pk2.product_id = p.id AND (pk2.providerName IS NULL OR pk2.providerName = ''))`);
    if (rows.length) {
      const ids = rows.map(r => `'${r.id}'`).join(',');
      // Backup products
      await queryRunner.query(`INSERT INTO _backup_removed_products_20250830 SELECT p.*, datetime('now') as removedAt FROM product p WHERE p.id IN (${ids})`);
      // Cascade delete (FK on product_id has onDelete CASCADE)
      await queryRunner.query(`DELETE FROM product WHERE id IN (${ids})`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot safely restore deleted products (backup table kept). Revert index only.
    try { await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_product_public_code"`); } catch {}
    // Recreate old unique index (if still desired)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_product_packages_tenant_public_code" ON "product_packages" ("tenantId", "publicCode") WHERE publicCode IS NOT NULL`);
  }
}
