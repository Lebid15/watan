import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds enabled boolean column to integrations (default true) if missing. */
export class AddIntegrationEnabled20250907T1100 implements MigrationInterface {
  name = 'AddIntegrationEnabled20250907T1100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(`SELECT 1 FROM information_schema.tables WHERE table_name='integrations'`);
    if (tableExists.length === 0) return;
    const hasCol = await queryRunner.hasColumn('integrations', 'enabled');
    if (!hasCol) {
      await queryRunner.query(`ALTER TABLE integrations ADD COLUMN "enabled" boolean DEFAULT true`);
    }
    // Normalize NULLs -> true
    await queryRunner.query(`UPDATE integrations SET "enabled"=true WHERE "enabled" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(`SELECT 1 FROM information_schema.tables WHERE table_name='integrations'`);
    if (tableExists.length === 0) return;
    const hasCol = await queryRunner.hasColumn('integrations', 'enabled');
    if (hasCol) {
      await queryRunner.query(`ALTER TABLE integrations DROP COLUMN "enabled"`);
    }
  }
}
