import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeveloperNotes20250906T0300 implements MigrationInterface {
  name = 'CreateDeveloperNotes20250906T0300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS developer_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        value TEXT NOT NULL DEFAULT '',
        singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE OR REPLACE FUNCTION trg_dev_notes_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS trg_dev_notes_upd ON developer_notes;
      CREATE TRIGGER trg_dev_notes_upd BEFORE UPDATE ON developer_notes
        FOR EACH ROW EXECUTE FUNCTION trg_dev_notes_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS developer_notes;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS trg_dev_notes_updated_at;`);
  }
}
