import { MigrationInterface, QueryRunner } from 'typeorm';

// Adjust uniqueness: make publicCode unique only within tenant (partial index),
// remove legacy global uniqueness if exists.
export class TenantScopedPackageCode1694200000000 implements MigrationInterface {
  name = 'TenantScopedPackageCode1694200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Detect existing global unique constraint / index patterns
    // Common legacy names we might have used earlier
    const legacyIndexes = [
      'ux_product_packages_public_code',
      'ux_product_packages_publicCode',
      'product_packages_public_code_key',
    ];
    for (const idx of legacyIndexes) {
      try {
        await queryRunner.query(`DROP INDEX IF EXISTS "${idx}"`);
      } catch { /* ignore */ }
    }

    // Ensure tenantId column index for performance
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_product_packages_tenant ON product_packages ("tenantId")`);

    // Create partial unique (tenantId, publicCode) where publicCode not null
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_pkg_tenant_public_code ON product_packages ("tenantId", "publicCode") WHERE "publicCode" IS NOT NULL`);

    // Also ensure we still keep the product-level uniqueness (product_id, publicCode) if required by code; if conflict leave only tenant scope.
    // Optional: leave existing product-level unique if present (we won't drop it automatically to avoid surprises).
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS ux_pkg_tenant_public_code');
    // We cannot safely restore the old global index automatically without risking conflicts; document instead.
  }
}
