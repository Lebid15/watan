import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase2: إضافة linkCode و nameDefault وفهرس فريد (catalogProductId, linkCode)
export class AddLinkCodeToCatalogPackage20250827T1400 implements MigrationInterface {
  name = 'AddLinkCodeToCatalogPackage20250827T1400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalog_package" ADD COLUMN IF NOT EXISTS "nameDefault" varchar(200)`);
    await queryRunner.query(`ALTER TABLE "catalog_package" ADD COLUMN IF NOT EXISTS "linkCode" varchar(80)`);
    // تنظيف قيم linkCode الفارغة الى NULL لتوحيد الفهرس
    await queryRunner.query(`UPDATE "catalog_package" SET "linkCode" = NULL WHERE trim(coalesce("linkCode", '')) = ''`);
    // إنشاء فهرس فريد شرطي يسمح بعدة NULL (Postgres يعامل NULL كقيمة مختلفة)
<<<<<<< HEAD
  // ملاحظة: يجب اقتباس "linkCode" في الشرط لأن عدم اقتباسه يحوّله postgres إلى linkcode ويؤدي لخطأ 42703
  await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_catalog_package_catalogProduct_linkCode" ON "catalog_package" ("catalogProductId", "linkCode") WHERE "linkCode" IS NOT NULL`);
=======
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_catalog_package_catalogProduct_linkCode" ON "catalog_package" ("catalogProductId", "linkCode") WHERE linkCode IS NOT NULL`);
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_catalog_package_catalogProduct_linkCode"`);
    await queryRunner.query(`ALTER TABLE "catalog_package" DROP COLUMN IF EXISTS "linkCode"`);
    await queryRunner.query(`ALTER TABLE "catalog_package" DROP COLUMN IF EXISTS "nameDefault"`);
  }
}
