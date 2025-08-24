import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFieldsToNotifications1754734605365 implements MigrationInterface {
  name = 'AddFieldsToNotifications1754734605365';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rescue: إنشاء الجدول إذا كان مفقوداً (نشر قديم بدون migration إنشاء)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name='notifications'
        ) THEN
          CREATE TABLE "notifications" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "tenantId" uuid NOT NULL,
            "user_id" uuid NOT NULL,
            "type" varchar(40) NOT NULL DEFAULT 'announcement',
            "title" varchar(200) NULL,
            "message" text NOT NULL,
            "meta" jsonb NULL,
            "isRead" boolean NOT NULL DEFAULT false,
            "readAt" timestamptz NULL,
            "link" varchar(300) NULL,
            "channel" varchar(20) NOT NULL DEFAULT 'in_app',
            "priority" varchar(10) NOT NULL DEFAULT 'normal',
            "createdAt" timestamptz NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_user" ON "notifications" ("tenantId", "user_id");
          CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_isread_created" ON "notifications" ("tenantId", "isRead", "createdAt");
          RAISE NOTICE 'Rescue created notifications table.';
        END IF;
      END$$;
    `);

    // إضافة الحقول الجديدة/القديمة لو ناقصة
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS "seenAt" TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS "meta" JSONB NULL,
      ADD COLUMN IF NOT EXISTS "isSilent" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
      DROP COLUMN IF EXISTS "isSilent",
      DROP COLUMN IF EXISTS "meta",
      DROP COLUMN IF EXISTS "seenAt",
      DROP COLUMN IF EXISTS "readAt"
    `);
  }
}
