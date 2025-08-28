import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';
import { DevSeedController } from './seed.controller';
import { DevFilteredProductsController } from './filtered-products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductPackage])],
  controllers: [DevSeedController, DevFilteredProductsController],
})
export class DevToolsModule {}