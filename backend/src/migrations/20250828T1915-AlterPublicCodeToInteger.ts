import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * تحويل عمود publicCode في product_packages من varchar إلى integer موجب (nullable)
 * الخطوات:
 * 1) إسقاط الفهارس الحالية المتعلقة بالعمود
 * 2) إنشاء عمود مؤقت publicCode_int
 * 3) نسخ القيم الرقمية الصالحة
 * 4) إسقاط العمود القديم
 * 5) إعادة تسمية العمود المؤقت إلى publicCode
 * 6) إضافة CHECK (publicCode > 0) + فهرس فريد + فهرس جزئي
 */
export class AlterPublicCodeToInteger20250828T1915 implements MigrationInterface {
  name = 'AlterPublicCodeToInteger20250828T1915';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) إسقاط الفهارس القديمة إن وجدت
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_packages_publicCode_notnull";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_public_code";`);

    // 2) إنشاء العمود المؤقت
    await queryRunner.query(`ALTER TABLE "product_packages" ADD COLUMN IF NOT EXISTS "publicCode_int" integer NULL;`);

    // 3) نسخ القيم الرقمية (نستبعد أي شيء غير رقمي/أقل من 1)
    await queryRunner.query(`UPDATE "product_packages" SET "publicCode_int" = CAST("publicCode" AS integer) WHERE "publicCode" ~ '^[0-9]+$' AND CAST("publicCode" AS integer) > 0;`);

    // 4) إسقاط العمود القديم
    await queryRunner.query(`ALTER TABLE "product_packages" DROP COLUMN "publicCode";`);

    // 5) إعادة تسمية العمود
    await queryRunner.query(`ALTER TABLE "product_packages" RENAME COLUMN "publicCode_int" TO "publicCode";`);

    // 6) إضافة القيد + الفهارس
    await queryRunner.query(`ALTER TABLE "product_packages" ADD CONSTRAINT "chk_product_packages_publicCode_positive" CHECK ("publicCode" IS NULL OR "publicCode" > 0);`);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_product_packages_public_code" ON "product_packages" ("publicCode") WHERE "publicCode" IS NOT NULL;`);
    // فهرس جزئي (قد يكون غير ضروري لأن الفهرس الفريد جزئي بالفعل، نُبقيه للتوافق مع الاستعلامات السابقة)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_product_packages_publicCode_notnull" ON "product_packages" ("publicCode") WHERE "publicCode" IS NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // العودة إلى varchar(40)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_packages_publicCode_notnull";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_product_packages_public_code";`);
    await queryRunner.query(`ALTER TABLE "product_packages" DROP CONSTRAINT IF EXISTS "chk_product_packages_publicCode_positive";`);

    await queryRunner.query(`ALTER TABLE "product_packages" ADD COLUMN IF NOT EXISTS "publicCode_old" varchar(40) NULL;`);
    await queryRunner.query(`UPDATE "product_packages" SET "publicCode_old" = CAST("publicCode" AS varchar) WHERE "publicCode" IS NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "product_packages" DROP COLUMN "publicCode";`);
    await queryRunner.query(`ALTER TABLE "product_packages" RENAME COLUMN "publicCode_old" TO "publicCode";`);

    // فهرس فريد عالمي (كما كان قبل التحويل)
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_product_packages_public_code" ON "product_packages" ("publicCode");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_product_packages_publicCode_notnull" ON "product_packages" ("publicCode") WHERE "publicCode" IS NOT NULL;`);
  }
}
