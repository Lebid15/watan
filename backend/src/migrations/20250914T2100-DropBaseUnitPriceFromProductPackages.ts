import { MigrationInterface, QueryRunner } from 'typeorm';

// Drops baseUnitPrice column since unit pricing now derives solely from price group rows.
export class DropBaseUnitPriceFromProductPackages20250914T2100 implements MigrationInterface {
  name = 'DropBaseUnitPriceFromProductPackages20250914T2100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE product_packages DROP COLUMN IF EXISTS "baseUnitPrice"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS "baseUnitPrice" decimal(12,4)');
  }
}
