import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrationScope20250821T0100 implements MigrationInterface {
  name = 'AddIntegrationScope20250821T0100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rescue: إنشاء الجدول إن كان مفقودًا (لتسلسل مهاجرات مكسور)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name='integrations'
        ) THEN
          CREATE TABLE "integrations" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "name" varchar(120) NOT NULL,
            "provider" varchar(20) NOT NULL,
            "baseUrl" varchar NULL,
            "apiToken" varchar NULL,
            "kod" varchar NULL,
            "sifre" varchar NULL,
            "createdAt" timestamptz NOT NULL DEFAULT now()
          );
          RAISE NOTICE 'Rescue created integrations table in AddIntegrationScope.';
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      ALTER TABLE "integrations"
      ADD COLUMN IF NOT EXISTS "scope" varchar(10) NOT NULL DEFAULT 'tenant'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "integrations"
      DROP COLUMN IF EXISTS "scope"
    `);
  }
}
