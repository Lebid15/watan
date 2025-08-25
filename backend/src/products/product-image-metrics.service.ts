import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { ProductImageMetricsSnapshot } from './product-image-metrics-snapshot.entity';

@Injectable()
export class ProductImageMetricsService {
  private readonly logger = new Logger('ProductImageMetrics');
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductImageMetricsSnapshot) private readonly snapshots: Repository<ProductImageMetricsSnapshot>,
  ) {}

  /** Collect counts of image usage and persist snapshot. */
  async collectOnce(): Promise<{ custom_active: number; catalog_active: number; missing: number }> {
    const rows = await this.products.query(`SELECT 
      COUNT(*) FILTER (WHERE "customImageUrl" IS NOT NULL AND COALESCE("useCatalogImage", true)=false) AS custom_active,
      COUNT(*) FILTER (WHERE ("customImageUrl" IS NULL OR COALESCE("useCatalogImage", true)=true) AND "catalogImageUrl" IS NOT NULL) AS catalog_active,
      COUNT(*) FILTER (WHERE ("customImageUrl" IS NULL OR COALESCE("useCatalogImage", true)=true) AND "catalogImageUrl" IS NULL) AS missing
      FROM product`);
    const r = rows?.[0] || {};
    const data = {
      custom_active: Number(r.custom_active) || 0,
      catalog_active: Number(r.catalog_active) || 0,
      missing: Number(r.missing) || 0,
    };
    try {
      const snapshot = this.snapshots.create({
        customCount: data.custom_active,
        catalogCount: data.catalog_active,
        missingCount: data.missing,
      });
      await this.snapshots.save(snapshot);
    } catch (err) {
      this.logger.error('persist snapshot failed', err as any);
    }
    this.logger.log(`[snapshot] custom=${data.custom_active} catalog=${data.catalog_active} missing=${data.missing}`);
    return data;
  }

  async latest(limit = 10): Promise<ProductImageMetricsSnapshot[]> {
    return this.snapshots.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  /** Compute day-over-day delta using two most recent snapshots >= ~24h apart if available. */
  async dayOverDayDelta(): Promise<{
    customDiff: number; catalogDiff: number; missingDiff: number; baselineTimestamp?: Date; latestTimestamp?: Date;
  } | null> {
    const snaps = await this.latest(20);
    if (snaps.length < 2) return null;
    const latest = snaps[0];
    // Find a snapshot at least 20h older (tolerate schedule drift)
    const targetOlder = snaps.find(s => (latest.createdAt.getTime() - s.createdAt.getTime()) >= 20 * 60 * 60 * 1000 && s.id !== latest.id);
    if (!targetOlder) return null;
    return {
      customDiff: latest.customCount - targetOlder.customCount,
      catalogDiff: latest.catalogCount - targetOlder.catalogCount,
      missingDiff: latest.missingCount - targetOlder.missingCount,
      baselineTimestamp: targetOlder.createdAt,
      latestTimestamp: latest.createdAt,
    };
  }
}

