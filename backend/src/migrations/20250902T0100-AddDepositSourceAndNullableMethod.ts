import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDepositSourceAndNullableMethod20250902T0100 implements MigrationInterface {
  name = 'AddDepositSourceAndNullableMethod20250902T0100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum type for source if not exists (Postgres)
    await queryRunner.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'deposit_source_enum' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."deposit_source_enum" AS ENUM ('user_request','admin_topup');
  END IF;
END$$;`);

    // Add column source with default
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='deposit' AND column_name='source'
        ) THEN
          ALTER TABLE "deposit" ADD COLUMN "source" "public"."deposit_source_enum" NOT NULL DEFAULT 'user_request';
        END IF;
      END$$;
    `);

    // Backfill existing rows (default already applied, but ensure non-null explicitly)
    await queryRunner.query(`UPDATE "deposit" SET "source"='user_request' WHERE "source" IS NULL;`);

    // Make method_id nullable (if it exists and constraint present)
    await queryRunner.query(`
      DO $$
      DECLARE
        col_nullable INTEGER;
      BEGIN
        -- Drop FK temporarily if exists (to alter nullability)
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_deposit_method') THEN
          ALTER TABLE "deposit" DROP CONSTRAINT "FK_deposit_method";
        END IF;
        -- Alter column to nullable if not already
        ALTER TABLE "deposit" ALTER COLUMN "method_id" DROP NOT NULL;
      END$$;
    `);

    // Recreate FK with ON DELETE RESTRICT allowing nulls
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_deposit_method') THEN
          ALTER TABLE "deposit"
            ADD CONSTRAINT "FK_deposit_method"
            FOREIGN KEY ("method_id") REFERENCES "payment_method"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: attempt to set NOT NULL again (may fail if null data left)
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Drop FK first
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_deposit_method') THEN
          ALTER TABLE "deposit" DROP CONSTRAINT "FK_deposit_method";
        END IF;
        -- Attempt to set NOT NULL (ignore errors if null values exist)
        BEGIN
          ALTER TABLE "deposit" ALTER COLUMN "method_id" SET NOT NULL;
        EXCEPTION WHEN others THEN NULL; END;
      END$$;
    `);

    // Drop source column
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN IF EXISTS "source";`);
    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."deposit_source_enum";`);

    // Recreate FK
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_deposit_method') THEN
          ALTER TABLE "deposit"
            ADD CONSTRAINT "FK_deposit_method"
            FOREIGN KEY ("method_id") REFERENCES "payment_method"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }
}
