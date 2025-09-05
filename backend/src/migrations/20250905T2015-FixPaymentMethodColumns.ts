import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures payment_method table has all columns used by PaymentMethod entity:
 * tenantId, logoUrl, note, config jsonb default '{}', createdAt/updatedAt defaults, unique tenant/name index.
 * Idempotent & additive.
 */
export class FixPaymentMethodColumns20250905T2015 implements MigrationInterface {
  name = 'FixPaymentMethodColumns20250905T2015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = (queryRunner.connection as any).options.type;
    if (driver !== 'postgres') return;

    // Add columns if missing
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_method' AND column_name='tenantId') THEN
        ALTER TABLE "payment_method" ADD COLUMN "tenantId" uuid NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_method' AND column_name='logoUrl') THEN
        ALTER TABLE "payment_method" ADD COLUMN "logoUrl" varchar(500) NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_method' AND column_name='note') THEN
        ALTER TABLE "payment_method" ADD COLUMN "note" text NULL;
      END IF;
      -- Ensure config column is jsonb with default '{}'
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_method' AND column_name='config') THEN
        -- If no default, set it
        PERFORM 1 FROM information_schema.columns WHERE table_name='payment_method' AND column_name='config' AND column_default IS NOT NULL;
        IF NOT FOUND THEN
          ALTER TABLE "payment_method" ALTER COLUMN "config" SET DEFAULT '{}';
        END IF;
      ELSE
        ALTER TABLE "payment_method" ADD COLUMN "config" jsonb NOT NULL DEFAULT '{}';
      END IF;
      -- createdAt / updatedAt defaults
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_method' AND column_name='createdAt') THEN
        PERFORM 1 FROM information_schema.columns WHERE table_name='payment_method' AND column_name='createdAt' AND column_default IS NOT NULL;
        IF NOT FOUND THEN
          ALTER TABLE "payment_method" ALTER COLUMN "createdAt" SET DEFAULT now();
        END IF;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_method' AND column_name='updatedAt') THEN
        PERFORM 1 FROM information_schema.columns WHERE table_name='payment_method' AND column_name='updatedAt' AND column_default IS NOT NULL;
        IF NOT FOUND THEN
          ALTER TABLE "payment_method" ALTER COLUMN "updatedAt" SET DEFAULT now();
        END IF;
      END IF;
    END $$;`);

    // Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_method_tenant" ON "payment_method" ("tenantId");`);
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname='UX_payment_method_tenant_name'
      ) THEN
        CREATE UNIQUE INDEX "UX_payment_method_tenant_name" ON "payment_method" ("tenantId","name");
      END IF; END $$;`);
  }

  public async down(): Promise<void> {
    // No destructive rollback.
  }
}
