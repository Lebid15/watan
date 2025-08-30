import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { ThumbnailService } from './thumbnail.service';

@Injectable()
export class ThumbnailScheduler {
  private readonly logger = new Logger('ThumbnailScheduler');
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly thumbs: ThumbnailService,
  ) {}

  // Run every 6 hours to fill missing thumbnails (lightweight)
  @Cron(CronExpression.EVERY_6_HOURS)
  async backfill() {
    try {
      const candidates = await this.products.find({ take: 2000 });
      let updated = 0;
      for (const p of candidates as any[]) {
        const effective = p.customImageUrl || p.imageUrl || null;
        if (!effective) continue;
        const needs = !p.thumbSmallUrl || !p.thumbMediumUrl || !p.thumbLargeUrl;
        if (!needs) continue;
        const vars = this.thumbs.generate(effective);
        p.thumbSmallUrl = vars.small;
        p.thumbMediumUrl = vars.medium;
        p.thumbLargeUrl = vars.large;
        await this.products.save(p);
        updated++;
      }
      if (updated) this.logger.log(`backfill generated thumbnails for ${updated} products`);
    } catch (err) {
      this.logger.error('thumbnail backfill failed', err as any);
    }
  }
}
