import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributorPricingController } from './distributor-pricing.controller';
import { DistributorOrdersController } from './distributor-orders.controller';
import { DistributorUsersController } from './distributor-users.controller';
import { DistributorPricingService } from './distributor-pricing.service';
import { DistributorPriceGroup, DistributorPackagePrice, DistributorUserPriceGroup } from './distributor-pricing.entities';
import { ProductPackage } from '../products/product-package.entity';
import { ProductOrder } from '../products/product-order.entity';
import { ProductsModule } from '../products/products.module';
import { Currency } from '../currencies/currency.entity';
import { User } from '../user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    DistributorPriceGroup,
    DistributorPackagePrice,
    DistributorUserPriceGroup,
    ProductPackage,
    ProductOrder,
  Currency,
  User,
  ]), ProductsModule],
  controllers: [DistributorPricingController, DistributorOrdersController, DistributorUsersController],
  providers: [DistributorPricingService],
  exports: [DistributorPricingService],
})
export class DistributorPricingModule {}
