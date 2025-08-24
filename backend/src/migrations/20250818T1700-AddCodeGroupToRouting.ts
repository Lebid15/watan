import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCodeGroupToRouting20250818T1700 implements MigrationInterface {
  name = 'AddCodeGroupToRouting20250818T1700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // أضِف الأعمدة فقط إن لم تكن موجودة
    // Rescue: إذا كان جدول package_routing غير موجود (تعطل Migration سابقة) أنشئ نسخة أساسية.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'package_routing'
        ) THEN
          CREATE TABLE "package_routing" (
            "id" uuid PRIMARY KEY,
            "package_id" uuid NOT NULL,
            "mode" varchar(10) NOT NULL DEFAULT 'manual',
            "primaryProviderId" varchar NULL,
            "fallbackProviderId" varchar NULL
          );
          RAISE NOTICE 'Rescue created table package_routing in AddCodeGroupToRouting migration.';
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      ALTER TABLE "package_routing"
      ADD COLUMN IF NOT EXISTS "providerType" varchar(32) NOT NULL DEFAULT 'manual'
    `);

    await queryRunner.query(`
      ALTER TABLE "package_routing"
      ADD COLUMN IF NOT EXISTS "codeGroupId" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "package_routing"
      DROP COLUMN IF EXISTS "codeGroupId"
    `);

    await queryRunner.query(`
      ALTER TABLE "package_routing"
      DROP COLUMN IF EXISTS "providerType"
    `);
  }
}
