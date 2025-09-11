import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';
import { DevSeedController } from './seed.controller';
import { DevFilteredProductsController } from './filtered-products.controller';
import { DevSeedProductsController } from './seed-products.controller';
import { DevMaintenanceController } from './maintenance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductPackage])],
  controllers: [DevSeedController, DevFilteredProductsController, DevSeedProductsController, DevMaintenanceController],
})
export class DevToolsModule {}