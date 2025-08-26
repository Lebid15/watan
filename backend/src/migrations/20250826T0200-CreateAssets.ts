import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAssets20250826T0200 implements MigrationInterface {
  name = 'CreateAssets20250826T0200';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const has = await q.hasTable('assets');
    if (!has) {
      await q.createTable(new Table({
        name: 'assets',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'tenantId', type: 'uuid', isNullable: true },
          { name: 'uploaderUserId', type: 'uuid', isNullable: true },
          { name: 'role', type: 'varchar', length: '32', isNullable: false },
          { name: 'purpose', type: 'varchar', length: '48', isNullable: false },
          { name: 'productId', type: 'uuid', isNullable: true },
          { name: 'originalName', type: 'varchar', length: '255', isNullable: false },
          { name: 'publicId', type: 'varchar', length: '255', isNullable: false },
          { name: 'format', type: 'varchar', length: '255', isNullable: false },
          { name: 'bytes', type: 'int', isNullable: false },
          { name: 'width', type: 'int', isNullable: true },
          { name: 'height', type: 'int', isNullable: true },
          { name: 'secureUrl', type: 'varchar', length: '400', isNullable: false },
          { name: 'folder', type: 'varchar', length: '400', isNullable: false },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }));
      await q.createIndex('assets', new TableIndex({ name: 'idx_assets_tenant', columnNames: ['tenantId'] }));
      await q.createIndex('assets', new TableIndex({ name: 'idx_assets_purpose', columnNames: ['purpose'] }));
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    const has = await q.hasTable('assets');
    if (!has) return;
    try { await q.dropIndex('assets', 'idx_assets_tenant'); } catch {}
    try { await q.dropIndex('assets', 'idx_assets_purpose'); } catch {}
    await q.dropTable('assets');
  }
}
