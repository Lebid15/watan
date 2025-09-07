import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOriginToProductOrders1694100000000 implements MigrationInterface {
  name = 'AddOriginToProductOrders1694100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "origin" varchar(20) NOT NULL DEFAULT 'panel'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Soft down: keep column if data relied on
    await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "origin"`);
  }
}
