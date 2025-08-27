import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantApiToken } from './tenant-api-token.entity';
import { IdempotencyKey } from './idempotency-key.entity';
import { User } from '../user/user.entity';
import { ProductOrder } from '../products/product-order.entity';
import { ProductPackage } from '../products/product-package.entity';
import { Product } from '../products/product.entity';
import { ExternalAuthGuard } from './external-auth.guard';
import { ScopeGuard } from './scope.guard';
import { ExternalPublicController } from './external-public.controller';
import { ExternalOrdersController } from './external-orders.controller';
import { TenantApiTokensController } from './tenant-api-tokens.controller';
import { TenantApiTokenService } from './tenant-api-tokens.service';
import { IdempotencyService } from './idempotency.service';
import { ProductsModule } from '../products/products.module';
import { ExternalRateLimitInterceptor } from './external-rate-limit.interceptor';
import { ExternalIdempotencyInterceptor } from './external-idempotency.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([TenantApiToken, IdempotencyKey, User, ProductOrder, ProductPackage, Product]), ProductsModule],
  controllers: [ExternalPublicController, ExternalOrdersController, TenantApiTokensController],
  providers: [ExternalAuthGuard, ScopeGuard, TenantApiTokenService, IdempotencyService, ExternalRateLimitInterceptor, ExternalIdempotencyInterceptor],
  exports: [TenantApiTokenService],
})
export class ExternalApiModule implements NestModule {
  configure(_consumer: MiddlewareConsumer) {}
}
