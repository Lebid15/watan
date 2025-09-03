import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovedAtToDeposits20250902T2310 implements MigrationInterface {
  name = 'AddApprovedAtToDeposits20250902T2310';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = (queryRunner.connection as any).options.type;
    if (driver === 'sqlite') {
      // SQLite: simple ADD COLUMN (ignores if already exists? no -> need guard)
      const cols: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info('deposit')`);
      const has = cols.some(c => c.name === 'approvedAt');
      if (!has) {
        await queryRunner.query(`ALTER TABLE "deposit" ADD COLUMN "approvedAt" datetime NULL`);
      }
      const colsForBackfill: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info('deposit')`);
      const hasCreatedAt = colsForBackfill.some(c => c.name === 'createdAt');
      const hasCreated_at = colsForBackfill.some(c => c.name === 'created_at');
      
      if (hasCreatedAt) {
        await queryRunner.query(`UPDATE "deposit" SET "approvedAt" = "createdAt" WHERE status='approved' AND (approvedAt IS NULL OR approvedAt = '')`);
      } else if (hasCreated_at) {
        await queryRunner.query(`UPDATE "deposit" SET "approvedAt" = "created_at" WHERE status='approved' AND (approvedAt IS NULL OR approvedAt = '')`);
      }
    } else {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='deposit' AND column_name='approvedAt'
          ) THEN
            ALTER TABLE "deposit" ADD COLUMN "approvedAt" TIMESTAMP WITH TIME ZONE NULL;
          END IF;
        END$$;
      `);
      // Backfill: for already approved deposits set approvedAt = createdAt (check both naming conventions)
      const hasCreatedAt = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns WHERE table_name='deposit' AND column_name='createdAt'
      `);
      const hasCreated_at = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns WHERE table_name='deposit' AND column_name='created_at'
      `);
      
      if (hasCreatedAt.length > 0) {
        await queryRunner.query(`UPDATE "deposit" SET "approvedAt" = "createdAt" WHERE status='approved' AND "approvedAt" IS NULL;`);
      } else if (hasCreated_at.length > 0) {
        await queryRunner.query(`UPDATE "deposit" SET "approvedAt" = "created_at" WHERE status='approved' AND "approvedAt" IS NULL;`);
      } else {
        console.log('AddApprovedAtToDeposits: No createdAt or created_at column found, skipping backfill');
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN IF EXISTS "approvedAt";`);
  }
}
