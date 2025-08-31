import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlacedByDistributorToOrders20250827T1455 implements MigrationInterface {
  name = 'AddPlacedByDistributorToOrders20250827T1455';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guarded plural table version (idempotent)
    await queryRunner.query(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product_orders') THEN
    ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "placedByDistributorId" uuid;
    BEGIN
      CREATE INDEX IF NOT EXISTS "IDX_product_orders_placedByDistributor" ON "product_orders" ("placedByDistributorId");
    EXCEPTION WHEN others THEN NULL; END;
  ELSE
    RAISE NOTICE 'Skipping placedByDistributorId migration (product_orders table missing)';
  END IF;
END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product_orders') THEN
    DROP INDEX IF EXISTS "IDX_product_orders_placedByDistributor";
    ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "placedByDistributorId";
  END IF;
END$$;`);
  }
}
