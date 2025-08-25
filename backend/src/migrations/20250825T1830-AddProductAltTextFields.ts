import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add catalogAltText & customAltText to product table.
 * Safe to run multiple times (IF NOT EXISTS pattern via dynamic checks per DB type where feasible).
 */
export class AddProductAltTextFields20250825T1830 implements MigrationInterface {
  name = 'AddProductAltTextFields20250825T1830';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;

    if (driver === 'sqlite') {
      // SQLite: quick pragma check then ALTER TABLE (adds nullable columns)
      const existing = await queryRunner.query(`PRAGMA table_info('product')`);
      const cols = new Set(existing.map((r: any) => r.name));
      if (!cols.has('catalogAltText')) {
        await queryRunner.query(`ALTER TABLE "product" ADD COLUMN "catalogAltText" varchar(300)`);
      }
      if (!cols.has('customAltText')) {
        await queryRunner.query(`ALTER TABLE "product" ADD COLUMN "customAltText" varchar(300)`);
      }
    } else if (driver === 'postgres') {
      // Postgres
      const hasCatalogAlt = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='catalogAltText'`);
      if (hasCatalogAlt.length === 0) {
        await queryRunner.query(`ALTER TABLE "product" ADD COLUMN "catalogAltText" varchar(300)`);
      }
      const hasCustomAlt = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='customAltText'`);
      if (hasCustomAlt.length === 0) {
        await queryRunner.query(`ALTER TABLE "product" ADD COLUMN "customAltText" varchar(300)`);
      }
    } else {
      // Fallback generic attempt
      try { await queryRunner.query(`ALTER TABLE "product" ADD COLUMN "catalogAltText" varchar(300)`); } catch {}
      try { await queryRunner.query(`ALTER TABLE "product" ADD COLUMN "customAltText" varchar(300)`); } catch {}
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non-destructive preference; implement drop for completeness for Postgres only
    const driver = queryRunner.connection.driver.options.type;
    if (driver === 'postgres') {
      try { await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "catalogAltText"`); } catch {}
      try { await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "customAltText"`); } catch {}
    }
    // SQLite: dropping columns requires table rebuild; skipping (down is noop there)
  }
}
