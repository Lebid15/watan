import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductOrdersController } from './product-orders.controller';
import { ProductOrdersAdminController } from './product-orders.admin.controller';

import { Product } from './product.entity';
import { ProductPackage } from './product-package.entity';
import { ProductApiMetadata } from './product-api-metadata.entity';
import { PackagePrice } from './package-price.entity';
import { PriceGroup } from './price-group.entity';
import { User } from '../user/user.entity';
import { ProductOrder } from './product-order.entity';
import { OrderDispatchLog } from './order-dispatch-log.entity';
import { Currency } from '../currencies/currency.entity';
// Distributor pricing entities needed for ProductsService snapshot logic
import { DistributorPackagePrice, DistributorUserPriceGroup, DistributorPriceGroup } from '../distributor/distributor-pricing.entities';

// كيانات الربط (من integrations)
import { PackageRouting } from '../integrations/package-routing.entity';
import { PackageCost } from '../integrations/package-cost.entity';
import { PackageMapping } from '../integrations/package-mapping.entity';

import { NotificationsModule } from '../notifications/notifications.module';
import { IntegrationsModule } from '../integrations/integrations.module';

import { OrdersMonitorService } from './orders-monitor.service';
import { AccountingPeriodsService } from '../accounting/accounting-periods.service';
import { ProductImageMetricsService } from './product-image-metrics.service';
import { ProductImageMetricsScheduler } from './product-image-metrics.scheduler';
import { ProductImageMetricsSnapshot } from './product-image-metrics-snapshot.entity';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ThumbnailService } from './thumbnail.service';
import { ThumbnailScheduler } from './thumbnail.scheduler';
import { ClientApiWebhookOutbox } from '../client-api/client-api-webhook-outbox.entity';
import { ClientApiWebhookEnqueueService } from '../client-api/client-api-webhook.enqueue.service';
import { IdempotentRequest } from './idempotent-request.entity';
import { ProductPackagesIndexGuardService } from './startup-index-guard.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductPackage,
      PackagePrice,
      PriceGroup,
  ProductOrder,
  ProductApiMetadata,
      OrderDispatchLog,

      User,
      Currency,

      PackageRouting,
      PackageCost,
  PackageMapping,
  ProductImageMetricsSnapshot,
  ClientApiWebhookOutbox,
  IdempotentRequest,
  // Distributor pricing entities (ensure availability for injection in ProductsService)
  DistributorPriceGroup,
  DistributorPackagePrice,
  DistributorUserPriceGroup,
    ]),
  NotificationsModule,
    IntegrationsModule,
  WebhooksModule,
  ],
  controllers: [
    ProductsController,
    ProductOrdersController,
    ProductOrdersAdminController,
  ],
  providers: [
    ProductsService,
    OrdersMonitorService,
    AccountingPeriodsService,
  ProductImageMetricsService,
  ProductImageMetricsScheduler,
  ThumbnailService,
  ThumbnailScheduler,
  ClientApiWebhookEnqueueService,
  ProductPackagesIndexGuardService,
  PricingService,
  ],
  exports: [
    ProductsService,
    AccountingPeriodsService,
    ProductImageMetricsService,
    ThumbnailService, // exported for AdminModule (ProductsAdminController)
  ],
})
export class ProductsModule {}
