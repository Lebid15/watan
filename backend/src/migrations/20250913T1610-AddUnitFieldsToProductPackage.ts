import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnitFieldsToProductPackage20250913T1610 implements MigrationInterface {
  name = 'AddUnitFieldsToProductPackage20250913T1610';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    await queryRunner.query(`ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS type varchar(10) NOT NULL DEFAULT 'fixed'`);
    await queryRunner.query(`ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS "unitName" varchar(40)`);
    await queryRunner.query(`ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS "unitCode" varchar(40)`);
    await queryRunner.query(`ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS "minUnits" int`);
    await queryRunner.query(`ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS "maxUnits" int`);
    await queryRunner.query(`ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS step int`);
    await queryRunner.query(`ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS "baseUnitPrice" decimal(12,4)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    await queryRunner.query(`ALTER TABLE product_packages DROP COLUMN IF EXISTS "baseUnitPrice"`);
    await queryRunner.query(`ALTER TABLE product_packages DROP COLUMN IF EXISTS step`);
    await queryRunner.query(`ALTER TABLE product_packages DROP COLUMN IF EXISTS "maxUnits"`);
    await queryRunner.query(`ALTER TABLE product_packages DROP COLUMN IF EXISTS "minUnits"`);
    await queryRunner.query(`ALTER TABLE product_packages DROP COLUMN IF EXISTS "unitCode"`);
    await queryRunner.query(`ALTER TABLE product_packages DROP COLUMN IF EXISTS "unitName"`);
    await queryRunner.query(`ALTER TABLE product_packages DROP COLUMN IF EXISTS type`);
  }
}
