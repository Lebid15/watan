import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey, TableCheck, TableUnique } from 'typeorm';

export class BillingInvoices20250829T1020 implements MigrationInterface {
  name = 'BillingInvoices20250829T1020';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      uniques: [ new TableUnique({ name: 'UQ_billing_invoices_tenant_period', columnNames: ['tenantId', 'periodStart', 'periodEnd'] }) ],
    }));

    await queryRunner.createCheckConstraint('billing_invoices', new TableCheck({ name: 'CHK_billing_invoices_status', expression: `status IN ('open','paid','void')` }));

    await queryRunner.createForeignKey('billing_invoices', new TableForeignKey({
      columnNames: ['tenantId'], referencedTableName: 'tenants', referencedColumnNames: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE'
    }));
    await queryRunner.createForeignKey('billing_invoices', new TableForeignKey({
      columnNames: ['depositId'], referencedTableName: 'deposit', referencedColumnNames: ['id'], onDelete: 'SET NULL', onUpdate: 'CASCADE'
    }));

    await queryRunner.createIndex('billing_invoices', new TableIndex({ name: 'IDX_billing_invoices_tenant_status', columnNames: ['tenantId', 'status'] }));
    await queryRunner.createIndex('billing_invoices', new TableIndex({ name: 'IDX_billing_invoices_dueAt', columnNames: ['dueAt'] }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('billing_invoices');
  }
}
