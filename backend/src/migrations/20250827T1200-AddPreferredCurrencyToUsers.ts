import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// Phase 1 Step 1: إضافة عمود مفضل العملة (NULLABLE)
export class AddPreferredCurrencyToUsers20250827T1200 implements MigrationInterface {
  name = 'AddPreferredCurrencyToUsers20250827T1200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('users', new TableColumn({
      name: 'preferredCurrencyCode',
      type: 'varchar',
      length: '10',
      isNullable: true,
    }));
    // فهرس مركب اختياري لتحسين الاستعلامات حسب العملة داخل التينانت
    try {
      await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_users_tenant_pref_currency ON users("tenantId", "preferredCurrencyCode")');
    } catch {}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try { await queryRunner.query('DROP INDEX IF EXISTS idx_users_tenant_pref_currency'); } catch {}
    await queryRunner.dropColumn('users', 'preferredCurrencyCode');
  }
}
