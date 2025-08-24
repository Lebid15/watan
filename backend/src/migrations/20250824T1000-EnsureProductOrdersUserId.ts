import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rescue migration: ensure product_orders has userId column (older prod table lacked it).
 * Safe / idempotent: only adds column if table exists and column missing.
 */
export class EnsureProductOrdersUserId20250824T1000 implements MigrationInterface {
  name = 'EnsureProductOrdersUserId20250824T1000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'product_orders'
        ) THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'product_orders' AND column_name = 'userId'
          ) THEN
            ALTER TABLE "product_orders" ADD COLUMN "userId" uuid NULL;
            RAISE NOTICE 'Rescue: added product_orders.userId column';
          END IF;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non-destructive rollback: keep the column if added (avoid accidental data loss)
    // If you really need to drop it manually, run:
    // ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "userId";
  }
}
