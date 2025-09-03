import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantIdToProductOrders20250903T1420 implements MigrationInterface {
  name = 'AddTenantIdToProductOrders20250903T1420';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTenantId = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns WHERE table_name='product_orders' AND column_name='tenantId'
    `);
    
    if (hasTenantId.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "product_orders" 
        ADD COLUMN "tenantId" uuid
      `);
      
      await queryRunner.query(`
        UPDATE "product_orders" 
        SET "tenantId" = '00000000-0000-0000-0000-000000000000' 
        WHERE "tenantId" IS NULL
      `);
      
      await queryRunner.query(`
        ALTER TABLE "product_orders" 
        ALTER COLUMN "tenantId" SET NOT NULL
      `);
    } else {
      console.log('AddTenantIdToProductOrders: tenantId column already exists, skipping migration');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_orders" 
      DROP COLUMN "tenantId"
    `);
  }
}
