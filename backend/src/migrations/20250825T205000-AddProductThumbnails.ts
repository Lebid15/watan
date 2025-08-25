import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds thumbnail columns for product images (idempotent safe). */
export class AddProductThumbnails20250825T205000 implements MigrationInterface {
  name = 'AddProductThumbnails20250825T205000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    if (driver === 'sqlite') {
      // SQLite: add columns if not exists (simple try/catch per column)
      const cols = ['thumbSmallUrl', 'thumbMediumUrl', 'thumbLargeUrl'];
      for (const c of cols) {
        try { await queryRunner.query(`ALTER TABLE product ADD COLUMN ${c} varchar(500)`); } catch (e) { /* ignore */ }
      }
      return;
    }

    // Postgres: conditional add
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='thumbSmallUrl') THEN
        ALTER TABLE "product" ADD COLUMN "thumbSmallUrl" varchar(500) NULL;
      END IF;
      IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='thumbMediumUrl') THEN
        ALTER TABLE "product" ADD COLUMN "thumbMediumUrl" varchar(500) NULL;
      END IF;
      IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='product' AND column_name='thumbLargeUrl') THEN
        ALTER TABLE "product" ADD COLUMN "thumbLargeUrl" varchar(500) NULL;
      END IF;
    END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    if (driver === 'sqlite') return; // no-op
    await queryRunner.query('ALTER TABLE "product" DROP COLUMN IF EXISTS "thumbSmallUrl"');
    await queryRunner.query('ALTER TABLE "product" DROP COLUMN IF EXISTS "thumbMediumUrl"');
    await queryRunner.query('ALTER TABLE "product" DROP COLUMN IF EXISTS "thumbLargeUrl"');
  }
}
