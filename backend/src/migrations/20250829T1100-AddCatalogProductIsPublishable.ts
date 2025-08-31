import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCatalogProductIsPublishable20250829T1100 implements MigrationInterface {
  name = 'AddCatalogProductIsPublishable20250829T1100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // أضف العمود إن لم يكن موجوداً
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='catalog_product')
           AND NOT EXISTS (
             SELECT 1 FROM information_schema.columns 
             WHERE table_name='catalog_product' AND column_name='isPublishable'
           )
        THEN
          ALTER TABLE "catalog_product" ADD COLUMN "isPublishable" boolean NOT NULL DEFAULT false;
        END IF;
      END;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='catalog_product' AND column_name='isPublishable'
        )
        THEN
          ALTER TABLE "catalog_product" DROP COLUMN "isPublishable";
        END IF;
      END;
      $$;
    `);
  }
}