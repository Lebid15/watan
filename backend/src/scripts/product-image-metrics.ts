import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProductImageMetricsService } from '../products/product-image-metrics.service';

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error','warn','log'] });
  try {
    const svc = app.get(ProductImageMetricsService);
  const snapshot = await svc.collectOnce();
  const latest = await svc.latest(5);
  // eslint-disable-next-line no-console
  console.log('[metrics] product-image current', snapshot);
  console.log('[metrics] last snapshots', latest.map(s => ({ createdAt: s.createdAt, custom: s.customCount, catalog: s.catalogCount, missing: s.missingCount })));
  } catch (err) {
    console.error('metrics collection failed', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
})();
