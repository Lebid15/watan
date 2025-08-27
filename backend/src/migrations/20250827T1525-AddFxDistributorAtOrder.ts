import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFxDistributorAtOrder20250827T1525 implements MigrationInterface {
  name = 'AddFxDistributorAtOrder20250827T1525'
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "fxUsdToDistAtOrder" DECIMAL(18,6)`);
    await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "distCurrencyCodeAtOrder" VARCHAR(10)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_fx_dist_code ON "product_orders" ("distCurrencyCodeAtOrder")`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "fxUsdToDistAtOrder"`);
    await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "distCurrencyCodeAtOrder"`);
  }
}
