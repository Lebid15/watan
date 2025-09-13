import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

/**
 * Startup guard to ensure product_packages publicCode uniqueness is product-scoped only.
 * - Verifies expected index exists
 * - Verifies legacy tenant-scoped indexes are absent
 * If STRICT_INDEX_GUARD=true it will throw and prevent app start; otherwise it logs an error.
 */
@Injectable()
export class ProductPackagesIndexGuardService implements OnModuleInit {
  private readonly logger = new Logger('ProductPackagesIndexGuard');

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    // Only run for postgres
    if ((this.dataSource.options as any).type !== 'postgres') return;
    try {
      const expected = 'ux_product_packages_product_public_code';
      const forbidden = [
        'ux_product_packages_tenant_public_code',
        'ux_pkg_tenant_public_code',
      ];
      const rows: { indexname: string }[] = await this.dataSource.query(
        `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='product_packages'`
      );
      const names = rows.map(r => r.indexname);
      const missing: string[] = names.includes(expected) ? [] : [expected];
      const leftover = forbidden.filter(f => names.includes(f));
      if (missing.length || leftover.length) {
        const msg = `[PKG][INDEX_GUARD] mismatch missing=${missing.join(',') || 'none'} leftover=${leftover.join(',') || 'none'}; set STRICT_INDEX_GUARD=true to enforce.`;
        if (process.env.STRICT_INDEX_GUARD === 'true') {
          this.logger.error(msg + ' Throwing (STRICT_INDEX_GUARD).');
          throw new Error(msg);
        }
        this.logger.error(msg);
      } else {
        this.logger.log('[PKG][INDEX_GUARD] indexes OK.');
      }
    } catch (e) {
      this.logger.error('[PKG][INDEX_GUARD] unexpected error', e as any);
      if (process.env.STRICT_INDEX_GUARD === 'true') throw e;
    }
  }
}
