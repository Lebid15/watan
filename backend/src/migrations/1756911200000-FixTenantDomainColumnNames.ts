import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTenantDomainColumnNames1756911200000 implements MigrationInterface {
  name = 'FixTenantDomainColumnNames1756911200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name='tenant_domain'
    `);
    
    if (tableExists.length === 0) {
      console.log('FixTenantDomainColumnNames: tenant_domain table does not exist, skipping');
      return;
    }

    const hasCreatedAt = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='tenant_domain' AND column_name='created_at'
    `);
    
    if (hasCreatedAt.length > 0) {
      await queryRunner.query(`ALTER TABLE "tenant_domain" RENAME COLUMN "created_at" TO "createdAt"`);
      console.log('FixTenantDomainColumnNames: Renamed created_at to createdAt');
    }

    const hasUpdatedAtSnake = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='tenant_domain' AND column_name='updated_at'
    `);
    
    if (hasUpdatedAtSnake.length > 0) {
      await queryRunner.query(`ALTER TABLE "tenant_domain" RENAME COLUMN "updated_at" TO "updatedAt"`);
      console.log('FixTenantDomainColumnNames: Renamed updated_at to updatedAt');
    }

    await queryRunner.query(`
      ALTER TABLE "tenant_domain" 
      ALTER COLUMN "createdAt" SET DEFAULT now(),
      ALTER COLUMN "updatedAt" SET DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenant_domain" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "tenant_domain" RENAME COLUMN "updatedAt" TO "updated_at"`);
  }
}
