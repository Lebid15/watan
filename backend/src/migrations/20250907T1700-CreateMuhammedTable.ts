import { MigrationInterface, QueryRunner, Table } from 'typeorm';

// Minimal daily data storage for the special 'muhammed' feature.
export class CreateMuhammedTable20250907T1700 implements MigrationInterface {
  name = 'CreateMuhammedTable20250907T1700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('muhammed_daily');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'muhammed_daily',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
            { name: 'entry_date', type: 'date', isNullable: false },
            { name: 'note', type: 'text', isNullable: true },
            { name: 'value', type: 'numeric', precision: 12, scale: 2, isNullable: true },
            { name: 'created_at', type: 'timestamptz', default: "timezone('utc', now())" },
            { name: 'updated_at', type: 'timestamptz', default: "timezone('utc', now())" },
          ],
          uniques: [
            { name: 'UQ_muhammed_daily_entry_date', columnNames: ['entry_date'] },
          ],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('muhammed_daily');
    if (hasTable) {
      await queryRunner.dropTable('muhammed_daily');
    }
  }
}
