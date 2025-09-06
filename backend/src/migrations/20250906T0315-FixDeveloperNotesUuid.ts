import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures developer_notes table exists and pgcrypto extension for gen_random_uuid().
 * Safe to run after initial CreateDeveloperNotes migration; idempotent guards.
 */
export class FixDeveloperNotesUuid20250906T0315 implements MigrationInterface {
  name = 'FixDeveloperNotesUuid20250906T0315';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='developer_notes') THEN
          CREATE TABLE developer_notes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            value TEXT NOT NULL DEFAULT '',
            singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        END IF;
      END $$;
      -- Adjust default if it was created without extension previously
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='developer_notes' AND column_name='id' AND column_default LIKE '%gen_random_uuid%'
        ) THEN
          ALTER TABLE developer_notes ALTER COLUMN id SET DEFAULT gen_random_uuid();
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // no-op: keep extension and table
  }
}
