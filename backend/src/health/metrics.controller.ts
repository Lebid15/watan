import { Controller, Get, Res, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductImageMetricsSnapshot } from '../products/product-image-metrics-snapshot.entity';

// Very lightweight Prometheus-style metrics (no external dep). Extend as needed.
@Controller('metrics')
export class MetricsController {
  constructor(
    @InjectRepository(ProductImageMetricsSnapshot) private readonly snaps: Repository<ProductImageMetricsSnapshot>,
  ) {}

  @Get()
  async metrics(@Res() res: Response) {
    const required = process.env.METRICS_TOKEN;
    if (required) {
      const header = (res.req.headers['authorization'] || '') as string;
      const bearer = header.startsWith('Bearer ') ? header.slice(7) : undefined;
      const queryToken = (res.req.query['token'] as string) || undefined;
      if (![bearer, queryToken].includes(required)) {
        throw new UnauthorizedException('metrics token required');
      }
    }
    // Latest snapshot only (avoid large payload)
    const last = await this.snaps.find({ order: { createdAt: 'DESC' }, take: 1 });
    const s = last[0];
    const lines: string[] = [];
    lines.push('# HELP product_image_custom_total Count of products using custom images');
    lines.push('# TYPE product_image_custom_total gauge');
    lines.push(`product_image_custom_total ${s ? s.customCount : 0}`);
    lines.push('# HELP product_image_catalog_total Count of products using catalog images');
    lines.push('# TYPE product_image_catalog_total gauge');
    lines.push(`product_image_catalog_total ${s ? s.catalogCount : 0}`);
    lines.push('# HELP product_image_missing_total Count of products missing images');
    lines.push('# TYPE product_image_missing_total gauge');
    lines.push(`product_image_missing_total ${s ? s.missingCount : 0}`);
    lines.push('# HELP product_image_snapshot_timestamp_seconds Timestamp of latest snapshot');
    lines.push('# TYPE product_image_snapshot_timestamp_seconds gauge');
    lines.push(`product_image_snapshot_timestamp_seconds ${s ? Math.floor(new Date(s.createdAt).getTime() / 1000) : 0}`);

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n') + '\n');
  }
}
