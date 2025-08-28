import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderNameToProductPackages20250829T1000 implements MigrationInterface {
  name = 'AddProviderNameToProductPackages20250829T1000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_packages" ADD COLUMN IF NOT EXISTS "providerName" varchar(120)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_packages_providerName" ON "product_packages" ("providerName")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // اختيارياً لا نحذف العمود لتفادي فقدان البيانات، لكن للتماثل سنحاول
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_packages_providerName"`);
    // لا نحذف العمود إذا كان يحتوي بيانات قيمة. يمكن تمكين الحذف بإزالة التعليق التالي:
    // await queryRunner.query(`ALTER TABLE "product_packages" DROP COLUMN IF EXISTS "providerName"`);
  }
}
