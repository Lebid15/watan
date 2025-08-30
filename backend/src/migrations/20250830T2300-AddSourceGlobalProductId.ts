import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddSourceGlobalProductId20250830T2300 implements MigrationInterface {
  name = 'AddSourceGlobalProductId20250830T2300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // إضافة العمود إن لم يكن موجوداً
    const table = await queryRunner.getTable('product');
    const has = table?.columns.find(c => c.name === 'sourceGlobalProductId');
    if (!has) {
      await queryRunner.addColumn('product', new TableColumn({
        name: 'sourceGlobalProductId',
        type: 'uuid',
        isNullable: true,
      }));
      await queryRunner.createIndex('product', new TableIndex({
        name: 'IDX_product_sourceGlobalProductId',
        columnNames: ['sourceGlobalProductId'],
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('product');
    if (!table) return;
    const has = table.columns.find(c => c.name === 'sourceGlobalProductId');
    if (has) {
      const idx = table.indices.find(i => i.name === 'IDX_product_sourceGlobalProductId');
      if (idx) await queryRunner.dropIndex('product', 'IDX_product_sourceGlobalProductId');
      await queryRunner.dropColumn('product', 'sourceGlobalProductId');
    }
  }
}
