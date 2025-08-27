import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDistributorSnapshotsToOrders20250827T1505 implements MigrationInterface {
  name = 'AddDistributorSnapshotsToOrders20250827T1505';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "distributorCapitalUsdAtOrder" DECIMAL(18,6)`);
    await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "distributorSellUsdAtOrder" DECIMAL(18,6)`);
    await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "distributorProfitUsdAtOrder" DECIMAL(18,6)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "distributorProfitUsdAtOrder"`);
    await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "distributorSellUsdAtOrder"`);
    await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "distributorCapitalUsdAtOrder"`);
  }
}
