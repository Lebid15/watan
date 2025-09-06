import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures developer_notes table exists and pgcrypto extension for gen_random_uuid().
 * Safe to run after initial CreateDeveloperNotes migration; idempotent guards.
 */
export class FixDeveloperNotesUuid20250906T0315 implements MigrationInterface {
  name = 'FixDeveloperNotesUuid20250906T0315';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extensions (idempotent)
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Table (idempotent)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS developer_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        value TEXT NOT NULL DEFAULT '',
        singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Ensure id default uses gen_random_uuid
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='developer_notes' AND column_name='id'
            AND (column_default IS NULL OR column_default NOT LIKE '%gen_random_uuid%')
        ) THEN
          ALTER TABLE developer_notes ALTER COLUMN id SET DEFAULT gen_random_uuid();
        END IF;
      END;
      $$;
    `);

    // Function for updated_at trigger (safe to recreate)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at_dev_notes() RETURNS trigger AS $dev$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $dev$ LANGUAGE plpgsql;
    `);

    // Trigger if missing
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
          WHERE c.relname='developer_notes' AND t.tgname='trg_developer_notes_updated_at'
        ) THEN
          CREATE TRIGGER trg_developer_notes_updated_at BEFORE UPDATE ON developer_notes
            FOR EACH ROW EXECUTE FUNCTION set_updated_at_dev_notes();
        END IF;
      END;
      $$;
    `);
  }

  public async down(): Promise<void> {
    // no-op: keep extension and table
  }
}
