import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDisplayOrderToMuhParties20250907T1905 implements MigrationInterface {
  name = 'AddDisplayOrderToMuhParties20250907T1905';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('muh_parties');
    if (hasTable) {
      const table = await queryRunner.getTable('muh_parties');
      const hasCol = table?.columns.some(c => c.name === 'display_order');
      if (!hasCol) {
        await queryRunner.addColumn('muh_parties', new TableColumn({ name: 'display_order', type: 'int', isNullable: true }));
        await queryRunner.query('CREATE INDEX IF NOT EXISTS IDX_muh_parties_display_order ON muh_parties(display_order)');
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('muh_parties');
    if (hasTable) {
      const table = await queryRunner.getTable('muh_parties');
      const hasCol = table?.columns.some(c => c.name === 'display_order');
      if (hasCol) {
        await queryRunner.dropColumn('muh_parties', 'display_order');
        try { await queryRunner.query('DROP INDEX IF EXISTS IDX_muh_parties_display_order'); } catch {}
      }
    }
  }
}