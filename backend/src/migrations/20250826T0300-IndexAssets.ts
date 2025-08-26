import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexAssets20250826T0300 implements MigrationInterface {
  name = 'IndexAssets20250826T0300';

  public async up(q: QueryRunner): Promise<void> {
    const has = await q.hasTable('assets');
    if (!has) return; // جدول غير موجود بعد؟ (بيئة قديمة)
    // فهرس مركب (tenantId, purpose, createdAt DESC) لتحسين استعلام القائمة.
    try { await q.query('CREATE INDEX IF NOT EXISTS idx_assets_tenant_purpose_createdAt ON assets ("tenantId", "purpose", "createdAt" DESC)'); } catch {}
    // فهرس productId للوصول السريع حسب المنتج.
    try { await q.query('CREATE INDEX IF NOT EXISTS idx_assets_productId ON assets ("productId")'); } catch {}
  }

  public async down(q: QueryRunner): Promise<void> {
    try { await q.query('DROP INDEX IF EXISTS idx_assets_tenant_purpose_createdAt'); } catch {}
    try { await q.query('DROP INDEX IF EXISTS idx_assets_productId'); } catch {}
  }
}
