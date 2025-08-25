import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProductImageMetricsService } from './product-image-metrics.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ProductImageMetricsSnapshot } from './product-image-metrics-snapshot.entity';

@Injectable()
export class ProductImageMetricsScheduler {
  private readonly logger = new Logger('ProductImageMetricsScheduler');
  constructor(
    private readonly metrics: ProductImageMetricsService,
    @InjectRepository(ProductImageMetricsSnapshot) private readonly snaps: Repository<ProductImageMetricsSnapshot>,
  ) {}

  // Twice daily snapshot (adjust as needed)
  @Cron(CronExpression.EVERY_12_HOURS)
  async snapshot() {
    try {
      await this.metrics.collectOnce();
    } catch (err) {
      this.logger.error('snapshot failed', err as any);
    }
  }

  // Daily cleanup: retain 30 days of snapshots (approx). Runs at 02:00 daily.
  @Cron('0 0 2 * * *')
  async cleanup() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
      const toDelete = await this.snaps.count({ where: { createdAt: LessThan(cutoff) } });
      if (toDelete > 0) {
        await this.snaps.delete({ createdAt: LessThan(cutoff) });
        this.logger.log(`cleanup removed ${toDelete} old snapshots`);
      }
    } catch (err) {
      this.logger.error('cleanup failed', err as any);
    }
  }
}
