import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';
import { ProductOrder } from '../products/product-order.entity';
import { PackagePrice } from '../products/package-price.entity';
import { ProductApiMetadata } from '../products/product-api-metadata.entity';
import { ClientApiController } from './client-api.controller';
import { ClientApiOpenapiPublicController } from './client-api.openapi.controller';
import { ClientApiAuthGuard } from './client-auth.guard';
import { ClientApiService } from './client-api.service';
import { ClientApiRequestLog } from './client-api-request-log.entity';
import { ClientApiLoggingInterceptor } from './client-api-logging.interceptor';
import { ClientApiStatsDaily } from './client-api-stats-daily.entity';
import { ClientApiStatsCron } from './client-api-stats.cron';
import { ClientApiWebhookOutbox } from './client-api-webhook-outbox.entity';
import { ClientApiWebhookWorker } from './client-api-webhook.worker';
import { ClientApiWebhookEnqueueService } from './client-api-webhook.enqueue.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { UserApiTokenRotation } from './user-api-token-rotation.entity';
import { ClientApiAdminController } from './client-api.admin.controller';
import { ClientApiWebhookAdminController } from './client-api-webhook.admin.controller';
import { ClientApiSelfController } from './client-api.self.controller';
import { ClientApiMeController } from './client-api.me.controller';
import { ClientApiAccountController } from './client-api-account.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    User,
    Product,
    ProductPackage,
    ProductOrder,
    PackagePrice,
    ProductApiMetadata,
    ClientApiRequestLog,
    UserApiTokenRotation,
    ClientApiStatsDaily,
    ClientApiWebhookOutbox,
  ])],
  controllers: [ClientApiOpenapiPublicController, ClientApiController, ClientApiAdminController, ClientApiWebhookAdminController, ClientApiSelfController, ClientApiMeController, ClientApiAccountController],
  providers: [ClientApiAuthGuard, ClientApiService, { provide: APP_INTERCEPTOR, useClass: ClientApiLoggingInterceptor }, ClientApiStatsCron, ClientApiWebhookWorker, ClientApiWebhookEnqueueService],
  exports: [],
})
export class ClientApiModule {}
