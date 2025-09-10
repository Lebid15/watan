import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drop legacy/global unique index on product_packages(publicCode) that blocks cloning,
 * and ensure the intended per-product unique index (product_id, publicCode) exists with NULL filter.
 */
export class DropGlobalPackagePublicCodeUnique20250910T1945 implements MigrationInterface {
  name = 'DropGlobalPackagePublicCodeUnique20250910T1945';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the accidental global unique index if present
    await queryRunner.query(`DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_product_packages_public_code') THEN
        EXECUTE 'DROP INDEX "ux_product_packages_public_code"';
      END IF;
    END$$;`);

    // Ensure per-product index exists (matches entity decorator)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_product_packages_product_public_code ON product_packages (product_id, "publicCode") WHERE "publicCode" IS NOT NULL;`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the global unique index only if explicitly needed (we leave it dropped by default)
    await queryRunner.query(`DROP INDEX IF EXISTS ux_product_packages_product_public_code;`);
    // Note: Not recreating ux_product_packages_public_code to avoid reintroducing the bug.
  }
}
