import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateDeveloperRole20250825T1400 implements MigrationInterface {
  name = 'UpdateDeveloperRole20250825T1400';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE users SET role='developer' WHERE lower(email)='alayatl.tr@gmail.com'`);
  }
  public async down(): Promise<void> { /* irreversible */ }
}