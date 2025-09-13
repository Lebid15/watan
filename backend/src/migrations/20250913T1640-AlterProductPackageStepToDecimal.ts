import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterProductPackageStepToDecimal20250913T1640 implements MigrationInterface {
  name = 'AlterProductPackageStepToDecimal20250913T1640';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    // تحويل الحقل step من int إلى decimal(12,4)
    const exists = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name='product_packages' AND column_name='step'`);
    if (exists?.length) {
      await queryRunner.query(`ALTER TABLE product_packages ALTER COLUMN step TYPE decimal(12,4)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if ((queryRunner.connection.options as any).type !== 'postgres') return;
    // إعادة الحقل إلى int (قد يؤدي لفقد دقة القيم، قرار مقبول في rollback)
    const exists = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name='product_packages' AND column_name='step'`);
    if (exists?.length) {
      await queryRunner.query(`ALTER TABLE product_packages ALTER COLUMN step TYPE int USING step::int`);
    }
  }
}
