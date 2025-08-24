import { MigrationInterface, QueryRunner } from "typeorm";

export class IncreaseProductPackageName20250820T0325 implements MigrationInterface {
  name = 'IncreaseProductPackageName20250820T0325';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // تكبير طول عمود الاسم إلى 160 حرف
    // Rescue: إنشاء جدول product_packages أساسي لو كان مفقوداً (بسبب فشل migrations سابقة)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'product_packages'
        ) THEN
          CREATE TABLE "product_packages" (
            "id" uuid PRIMARY KEY,
            "tenantId" uuid NOT NULL,
            "publicCode" varchar(40) NULL,
            "name" varchar(100) NULL,
            "description" text NULL,
            "imageUrl" varchar NULL,
            "basePrice" numeric(10,2) NOT NULL DEFAULT 0,
            "capital" numeric(10,2) NOT NULL DEFAULT 0,
            "isActive" boolean NOT NULL DEFAULT true,
            "product_id" uuid NULL
          );
          RAISE NOTICE 'Rescue created table product_packages (baseline) in IncreaseProductPackageName migration.';
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      ALTER TABLE "product_packages"
      ALTER COLUMN "name" TYPE varchar(160)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // الرجوع للطول السابق 100 حرف
    await queryRunner.query(`
      ALTER TABLE "product_packages"
      ALTER COLUMN "name" TYPE varchar(100)
    `);
  }
}
