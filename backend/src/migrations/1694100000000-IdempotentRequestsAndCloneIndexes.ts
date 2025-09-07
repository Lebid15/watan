import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class IdempotentRequestsAndCloneIndexes1694100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // idempotent_requests table
    await queryRunner.createTable(new Table({
      name: 'idempotent_requests',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'now()' },
        { name: 'key', type: 'varchar', length: '190', isNullable: false },
        { name: 'tenant_id', type: 'uuid', isNullable: true },
        { name: 'source_global_product_id', type: 'uuid', isNullable: true },
        { name: 'result_json', type: 'jsonb', isNullable: false },
      ],
    }), true);

    await queryRunner.createIndex('idempotent_requests', new TableIndex({
      name: 'idx_idempotent_requests_key',
      columnNames: ['key'],
      isUnique: true,
    }));

    // unique partial index for (tenant_id, source_global_product_id)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_product_clone_once" ON products (tenant_id, source_global_product_id) WHERE source_global_product_id IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "uq_product_clone_once"');
    await queryRunner.dropIndex('idempotent_requests', 'idx_idempotent_requests_key');
    await queryRunner.dropTable('idempotent_requests');
  }
}
