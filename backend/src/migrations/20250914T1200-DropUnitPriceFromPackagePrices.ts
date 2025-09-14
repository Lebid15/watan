import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUnitPriceFromPackagePrices20250914T1200 implements MigrationInterface {
  name = 'DropUnitPriceFromPackagePrices20250914T1200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    await queryRunner.query('ALTER TABLE package_prices DROP COLUMN IF EXISTS "unitPrice"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    await queryRunner.query('ALTER TABLE package_prices ADD COLUMN IF NOT EXISTS "unitPrice" decimal(12,4)');
  }
}
