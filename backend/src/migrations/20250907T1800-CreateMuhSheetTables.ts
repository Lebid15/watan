import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateMuhSheetTables20250907T1800 implements MigrationInterface {
  name = 'CreateMuhSheetTables20250907T1800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasParties = await queryRunner.hasTable('muh_parties');
    if (!hasParties) {
      await queryRunner.createTable(new Table({
        name: 'muh_parties',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
          { name: 'name', type: 'varchar', length: '160' },
          { name: 'debt_try', type: 'numeric', precision: 14, scale: 2, default: '0' },
          { name: 'debt_usd', type: 'numeric', precision: 14, scale: 2, default: '0' },
          { name: 'note', type: 'text', isNullable: true },
          { name: 'updated_at', type: 'timestamptz', default: "timezone('utc', now())" },
        ],
      }));
    }

    const hasSettings = await queryRunner.hasTable('muh_settings');
    if (!hasSettings) {
      await queryRunner.createTable(new Table({
        name: 'muh_settings',
        columns: [
          { name: 'id', type: 'int', isPrimary: true },
          { name: 'usd_to_try', type: 'numeric', precision: 14, scale: 4, default: '30' },
        ],
      }));
      await queryRunner.query("INSERT INTO muh_settings (id, usd_to_try) VALUES (1, 30) ON CONFLICT (id) DO NOTHING");
    }

    const hasExports = await queryRunner.hasTable('muh_exports');
    if (!hasExports) {
      await queryRunner.createTable(new Table({
        name: 'muh_exports',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
          { name: 'total_usd_at_export', type: 'numeric', precision: 18, scale: 4 },
          { name: 'usd_to_try_at_export', type: 'numeric', precision: 14, scale: 4 },
          { name: 'created_at', type: 'timestamptz', default: "timezone('utc', now())" },
        ],
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const drop = async (name: string) => { if (await queryRunner.hasTable(name)) await queryRunner.dropTable(name); };
    await drop('muh_exports');
    await drop('muh_parties');
    await drop('muh_settings');
  }
}
