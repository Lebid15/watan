import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExportSnapshot20250907T1900 implements MigrationInterface {
  name = 'AddExportSnapshot20250907T1900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('muh_exports');
    if (!hasTable) {
      // Table missing (earlier migration not applied yet); soft-skip for idempotency
      return;
    }
    const hasColumn = await queryRunner.hasColumn('muh_exports', 'snapshot');
    if (!hasColumn) {
      await queryRunner.query(`ALTER TABLE muh_exports ADD COLUMN snapshot jsonb NULL`);
      // No backfill for older rows (will appear without details)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('muh_exports');
    if (!hasTable) return;
    const hasColumn = await queryRunner.hasColumn('muh_exports', 'snapshot');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE muh_exports DROP COLUMN snapshot`);
    }
  }
}
