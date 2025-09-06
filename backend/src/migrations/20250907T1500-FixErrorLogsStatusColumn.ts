import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normalizes legacy error_logs.status (int in bootstrap) to varchar(10) with default 'open'.
 * Safe / idempotent: only alters if existing column is integer.
 */
export class FixErrorLogsStatusColumn20250907T1500 implements MigrationInterface {
  name = 'FixErrorLogsStatusColumn20250907T1500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.query(`SELECT 1 FROM information_schema.tables WHERE table_name='error_logs'`);
    if (exists.length === 0) return;
    const col = await queryRunner.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name='error_logs' AND column_name='status'
    `);
    const type = col?.[0]?.data_type;
    if (type && type !== 'character varying') {
      await queryRunner.query(`ALTER TABLE "error_logs" ALTER COLUMN "status" TYPE varchar(10) USING status::text`);
      await queryRunner.query(`ALTER TABLE "error_logs" ALTER COLUMN "status" SET DEFAULT 'open'`);
      await queryRunner.query(`UPDATE "error_logs" SET status='open' WHERE status IS NULL OR status=''`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // no-op (we don't want to revert to int)
  }
}
