import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex, TableCheck } from 'typeorm';

export class TenantBillingConfig20250829T1000 implements MigrationInterface {
  name = 'TenantBillingConfig20250829T1000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'tenant_billing_config',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'tenantId', type: 'uuid', isUnique: true },
        { name: 'monthlyPriceUsd', type: 'numeric', precision: 18, scale: 6, isNullable: true },
        { name: 'billingAnchor', type: 'varchar', length: '8', default: `'EOM'` },
        { name: 'graceDays', type: 'int', default: '3' },
        { name: 'isEnforcementEnabled', type: 'boolean', default: 'false' },
        { name: 'fxUsdToTenantAtInvoice', type: 'boolean', default: 'true' },
        { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
      ],
    }));

    await queryRunner.createIndex('tenant_billing_config', new TableIndex({
      name: 'IDX_tenant_billing_config_tenant',
      columnNames: ['tenantId'],
    }));

    await queryRunner.createCheckConstraint('tenant_billing_config', new TableCheck({
      name: 'CHK_tenant_billing_config_anchor',
      expression: `"billingAnchor" IN ('EOM','DOM')`,
    }));

    await queryRunner.createForeignKey('tenant_billing_config', new TableForeignKey({
      columnNames: ['tenantId'],
      referencedTableName: 'tenant',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tenant_billing_config');
  }
}
