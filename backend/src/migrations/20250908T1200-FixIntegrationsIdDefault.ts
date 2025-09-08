import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ضمان وجود DEFAULT لتوليد UUID تلقائي لعمود id في جدول integrations.
 * بعض البيئات فقدت الـ default بعد ترقيات سابقة، ما سبب إدخالات NULL.
 * الهجرة idempotent (التنفيذ المتكرر آمن).
 */
export class FixIntegrationsIdDefault20250908T1200 implements MigrationInterface {
  name = 'FixIntegrationsIdDefault20250908T1200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // تأمين الامتدادات المطلوبة (واحد يكفي لكن نضيف الاثنين بأمان)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // فحص current default
    const row: any = await queryRunner.query(`
      SELECT column_default FROM information_schema.columns
      WHERE table_name='integrations' AND column_name='id'
    `);
    const currentDefault = Array.isArray(row) && row.length > 0 ? row[0].column_default : null;

    // إذا لا يوجد default أو قيمة فارغة/مسافة نضبط gen_random_uuid()
    if (!currentDefault || !String(currentDefault).trim()) {
      await queryRunner.query(`ALTER TABLE "integrations" ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // إعادة الوضع السابق (إزالة الـ default). هذا قد يعيد المشكلة إن كانت موجودة، لكن يحافظ على قابلية التراجع.
    await queryRunner.query(`ALTER TABLE "integrations" ALTER COLUMN id DROP DEFAULT`);
  }
}
