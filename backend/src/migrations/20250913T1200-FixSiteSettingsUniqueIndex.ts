import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FixSiteSettingsUniqueIndex
 *
 * الهدف:
 * 1. إزالة أي فهرس/قيد فريد قديم أحادي على (key) فقط: "UQ_site_settings_key" أو "UQ_site_settings_key_idx".
 * 2. ضمان وجود الفهرس المركب الفريد (tenantId,key) ليمنع التضارب ويتيح نفس المفتاح لمستأجرين مختلفين.
 */
export class FixSiteSettingsUniqueIndex20250913T1200 implements MigrationInterface {
  name = 'FixSiteSettingsUniqueIndex20250913T1200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // تحقق وجود الجدول أولا (حماية وقائية)
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='site_settings') THEN
        RAISE NOTICE 'site_settings table not found, skipping index fixes';
        RETURN; 
      END IF; 
    END $$;`);

    // إسقاط القيد إن وجد (قد يكون قيد وليس index)
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name='UQ_site_settings_key' AND table_name='site_settings'
      ) THEN
        ALTER TABLE "site_settings" DROP CONSTRAINT "UQ_site_settings_key";
        RAISE NOTICE 'Dropped legacy constraint UQ_site_settings_key';
      END IF;
    END $$;`);

    // إسقاط الفهرس الأحادي إن وجد
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname='UQ_site_settings_key_idx'
      ) THEN
        DROP INDEX "UQ_site_settings_key_idx";
        RAISE NOTICE 'Dropped legacy index UQ_site_settings_key_idx';
      END IF;
    END $$;`);

    // إنشاء الفهرس المركب إن لم يوجد
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_site_settings_tenant_key" ON "site_settings" ("tenantId","key")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // لا نُعيد المؤشر الأحادي لأنه غير مرغوب.
    // إبقاء المركب كما هو (عدم كسر الإنتاج عند rollback).
    console.log('[Migration:down] No rollback for FixSiteSettingsUniqueIndex');
  }
}
