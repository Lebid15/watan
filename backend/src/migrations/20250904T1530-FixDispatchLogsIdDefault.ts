import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * تضيف DEFAULT uuid_generate_v4() لعمود id في order_dispatch_logs لو مفقود لمنع أخطاء null value.
 */
export class FixDispatchLogsIdDefault20250904T1530 implements MigrationInterface {
  name = 'FixDispatchLogsIdDefault20250904T1530';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_dispatch_logs' AND column_name='id') THEN
          -- تأكد من وجود الامتداد
          IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
          END IF;
          -- فحص إن كان للعمود DEFAULT
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='order_dispatch_logs' AND column_name='id' AND column_default LIKE 'uuid_generate_v4%'
          ) THEN
            ALTER TABLE "order_dispatch_logs" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
          END IF;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_dispatch_logs" ALTER COLUMN "id" DROP DEFAULT;
    `);
  }
}
