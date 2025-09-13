import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnitPriceToPackagePrice20250913T1620 implements MigrationInterface {
  name = 'AddUnitPriceToPackagePrice20250913T1620';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    await queryRunner.query(`ALTER TABLE package_prices ADD COLUMN IF NOT EXISTS "unitPrice" decimal(12,4)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    await queryRunner.query(`ALTER TABLE package_prices DROP COLUMN IF EXISTS "unitPrice"`);
  }
}
