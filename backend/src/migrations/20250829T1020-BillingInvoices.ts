import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey, TableCheck, TableUnique } from 'typeorm';

export class BillingInvoices20250829T1020 implements MigrationInterface {
  name = 'BillingInvoices20250829T1020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('billing_invoices');
    if (!hasTable) {
      // Original create logic
      await queryRunner.createTable(new Table({
        name: 'billing_invoices',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'tenantId', type: 'uuid' },
          { name: 'periodStart', type: 'date' },
          { name: 'periodEnd', type: 'date' },
          { name: 'amountUsd', type: 'numeric', precision: 18, scale: 6 },
          { name: 'fxUsdToTenantAtInvoice', type: 'numeric', precision: 18, scale: 6, isNullable: true },
          { name: 'displayCurrencyCode', type: 'varchar', length: '10', isNullable: true },
          { name: 'status', type: 'varchar', length: '8', default: `'open'` },
          { name: 'issuedAt', type: 'timestamptz', default: 'now()' },
          { name: 'dueAt', type: 'timestamptz', isNullable: true },
          { name: 'paidAt', type: 'timestamptz', isNullable: true },
          { name: 'depositId', type: 'uuid', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_billing_invoices_tenant_period',
            columnNames: ['tenantId', 'periodStart', 'periodEnd'],
          }),
        ],
      }));
    } else {
      // Patch existing minimal baseline (added by bootstrap) to add missing columns / constraints / indexes.
      const addColumn = async (name: string, definition: string) => {
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_invoices' AND column_name='${name}') THEN ALTER TABLE "billing_invoices" ADD COLUMN ${definition}; END IF; END$$;`);
      };
      await addColumn('periodStart', '"periodStart" date');
      await addColumn('periodEnd', '"periodEnd" date');
      await addColumn('amountUsd', '"amountUsd" numeric(18,6)');
      await addColumn('fxUsdToTenantAtInvoice', '"fxUsdToTenantAtInvoice" numeric(18,6)');
      await addColumn('displayCurrencyCode', '"displayCurrencyCode" varchar(10)');
  // Correct default syntax (previously used invalid \"open\" which Postgres treated as identifier)
  await addColumn('status', '"status" varchar(8) DEFAULT \'open\'');
      await addColumn('issuedAt', '"issuedAt" timestamptz DEFAULT now()');
      await addColumn('dueAt', '"dueAt" timestamptz');
      await addColumn('paidAt', '"paidAt" timestamptz');
      await addColumn('notes', '"notes" text');
      await addColumn('updatedAt', '"updatedAt" timestamptz DEFAULT now()');
      // Unique constraint
      await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='UQ_billing_invoices_tenant_period') THEN
          ALTER TABLE "billing_invoices" ADD CONSTRAINT "UQ_billing_invoices_tenant_period" UNIQUE ("tenantId","periodStart","periodEnd");
        END IF; END$$;`);
      // Check constraint
      await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CHK_billing_invoices_status') THEN
          ALTER TABLE "billing_invoices" ADD CONSTRAINT "CHK_billing_invoices_status" CHECK (status IN ('open','paid','void'));
        END IF; END$$;`);
      // Foreign keys (ignore errors if referenced tables not yet created; migrations later will add them)
      await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='FK_billing_invoices_tenant') THEN
          BEGIN
            ALTER TABLE "billing_invoices" ADD CONSTRAINT "FK_billing_invoices_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          EXCEPTION WHEN others THEN NULL; END;
        END IF; END$$;`);
      await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='FK_billing_invoices_deposit') THEN
          BEGIN
            ALTER TABLE "billing_invoices" ADD CONSTRAINT "FK_billing_invoices_deposit" FOREIGN KEY ("depositId") REFERENCES "deposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          EXCEPTION WHEN others THEN NULL; END;
        END IF; END$$;`);
      // Indexes
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_billing_invoices_tenant_status" ON "billing_invoices" ("tenantId","status");`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_billing_invoices_dueAt" ON "billing_invoices" ("dueAt");`);
    }

    // Ensure check constraint present if we created table normally (original path)
    if (!hasTable) {
      await queryRunner.createCheckConstraint(
        'billing_invoices',
        new TableCheck({
          name: 'CHK_billing_invoices_status',
          expression: `status IN ('open','paid','void')`,
        }),
      );

      await queryRunner.createForeignKey(
        'billing_invoices',
        new TableForeignKey({
          columnNames: ['tenantId'],
          referencedTableName: 'tenant',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        }),
      );

      await queryRunner.createForeignKey(
        'billing_invoices',
        new TableForeignKey({
          columnNames: ['depositId'],
          referencedTableName: 'deposit',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        }),
      );

      await queryRunner.createIndex(
        'billing_invoices',
        new TableIndex({
          name: 'IDX_billing_invoices_tenant_status',
          columnNames: ['tenantId', 'status'],
        }),
      );

      await queryRunner.createIndex(
        'billing_invoices',
        new TableIndex({
          name: 'IDX_billing_invoices_dueAt',
          columnNames: ['dueAt'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('billing_invoices');
  }
}
