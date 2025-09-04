import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds snapshot columns for USD values at order creation.
 * - sellUsdAtOrder
 * - costUsdAtOrder
 * - profitUsdAtOrder
 *
 * For existing rows: initialize sellUsdAtOrder = price; cost/profit left null so they can be backfilled later
 * (or on next approval/update logic if desired).
 */
export class AddUsdSnapshotsToOrders20250904T1200 implements MigrationInterface {
  name = 'AddUsdSnapshotsToOrders20250904T1200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "sellUsdAtOrder" numeric(12,4)`);
    await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "costUsdAtOrder" numeric(12,4)`);
    await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "profitUsdAtOrder" numeric(12,4)`);
    // Initialize sellUsdAtOrder from legacy price field where null
    await queryRunner.query(`UPDATE "product_orders" SET "sellUsdAtOrder" = price WHERE "sellUsdAtOrder" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "profitUsdAtOrder"`);
    await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "costUsdAtOrder"`);
    await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "sellUsdAtOrder"`);
  }
}
