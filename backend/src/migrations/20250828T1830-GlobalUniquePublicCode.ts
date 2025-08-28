import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: جعل publicCode فريد عالميًا في product_packages
 * - إسقاط الفهرس المركب القديم (إن وُجد)
 * - إنشاء فهرس UNIQUE عالمي على publicCode
 * - إنشاء فهرس جزئي اختياري لتحسين الاستعلامات WHERE publicCode IS NOT NULL
 */
export class GlobalUniquePublicCode20250828T1830 implements MigrationInterface {
  name = 'GlobalUniquePublicCode20250828T1830';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // إسقاط الفهرس المركّب القديم إن كان موجوداً
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_public_code_tenant";`);
    // إسقاط أي فهرس سابق بنفس الاسم الجديد لتجنب التعارض في بيئات التطوير
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_public_code";`);
    // إنشاء الفهرس العالمي الجديد
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_product_packages_public_code" ON "product_packages" ("publicCode");`);
    // فهرس جزئي لتحسين فلاتر الاستعلام (اختياري)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_product_packages_publicCode_notnull" ON "product_packages" ("publicCode") WHERE "publicCode" IS NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_packages_publicCode_notnull";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_public_code";`);
    // إعادة الفهرس المركب السابق
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_product_packages_public_code_tenant" ON "product_packages" ("tenantId","publicCode");`);
  }
}
