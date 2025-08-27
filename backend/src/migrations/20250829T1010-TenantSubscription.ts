import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableCheck } from 'typeorm';

export class TenantSubscription20250829T1010 implements MigrationInterface {
  name = 'TenantSubscription20250829T1010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'tenant_subscriptions',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'tenantId', type: 'uuid', isUnique: true },
        { name: 'status', type: 'varchar', length: '16', default: `'active'` },
        { name: 'currentPeriodStart', type: 'date', isNullable: true },
        { name: 'currentPeriodEnd', type: 'date', isNullable: true },
        { name: 'nextDueAt', type: 'timestamptz', isNullable: true },
        { name: 'lastPaidAt', type: 'timestamptz', isNullable: true },
        { name: 'suspendAt', type: 'timestamptz', isNullable: true },
        { name: 'suspendReason', type: 'varchar', length: '120', isNullable: true },
        { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
      ],
    }));

    await queryRunner.createCheckConstraint('tenant_subscriptions', new TableCheck({
      name: 'CHK_tenant_subscriptions_status',
      expression: `status IN ('active','suspended')`,
    }));

    await queryRunner.createForeignKey('tenant_subscriptions', new TableForeignKey({
      columnNames: ['tenantId'],
      referencedTableName: 'tenants',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tenant_subscriptions');
  }
}
