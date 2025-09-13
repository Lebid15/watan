import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnitFieldsToProductOrders20250913T1630 implements MigrationInterface {
  name = 'AddUnitFieldsToProductOrders20250913T1630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    await queryRunner.query(`ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS "unitPriceApplied" decimal(12,4)`);
    await queryRunner.query(`ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS "sellPrice" decimal(12,4)`);
    await queryRunner.query(`ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS "cost" decimal(12,4)`);
    await queryRunner.query(`ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS "profit" decimal(12,4)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    await queryRunner.query(`ALTER TABLE product_orders DROP COLUMN IF EXISTS "profit"`);
    await queryRunner.query(`ALTER TABLE product_orders DROP COLUMN IF EXISTS "cost"`);
    await queryRunner.query(`ALTER TABLE product_orders DROP COLUMN IF EXISTS "sellPrice"`);
    await queryRunner.query(`ALTER TABLE product_orders DROP COLUMN IF EXISTS "unitPriceApplied"`);
  }
}
