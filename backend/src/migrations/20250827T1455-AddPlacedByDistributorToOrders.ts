import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlacedByDistributorToOrders20250827T1455 implements MigrationInterface {
  name = 'AddPlacedByDistributorToOrders20250827T1455';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_order" ADD COLUMN IF NOT EXISTS "placedByDistributorId" uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_order_placedByDistributor" ON "product_order" ("placedByDistributorId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_product_order_placedByDistributor"');
    await queryRunner.query('ALTER TABLE "product_order" DROP COLUMN IF EXISTS "placedByDistributorId"');
  }
}
