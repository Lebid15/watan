import { Controller, Post, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';

// Minimal dev controller after removing catalog/providers features.
// Provides a simple seed + status + repair (alias) endpoints.
@Controller('dev/filtered-products-sync')
export class DevFilteredProductsController {
  private readonly PSEUDO_TENANT = '00000000-0000-0000-0000-000000000000';

  constructor(
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    @InjectRepository(ProductPackage) private readonly packagesRepo: Repository<ProductPackage>,
  ) {}

  @Post()
  async sync() {
    const beforeProducts = await this.productsRepo.count();
    const beforePackages = await this.packagesRepo.count();

    if (beforeProducts === 0) {
      const prod = await this.productsRepo.save(this.productsRepo.create({
        tenantId: this.PSEUDO_TENANT,
        name: 'Demo Product',
        description: 'Simplified demo product (no catalog)',
  isActive: true,
      } as any));
      for (let i = 1; i <= 2; i++) {
        const pkg = this.packagesRepo.create({
          tenantId: this.PSEUDO_TENANT,
          name: 'Demo Package ' + i,
          basePrice: 10 * i,
          capital: 10 * i,
          isActive: true,
          publicCode: null,
        } as any);
        (pkg as any).product = prod; // set relation explicitly
        await this.packagesRepo.save(pkg as any);
      }
      return { fallbackSeeded: true, beforeProducts, beforePackages, afterProducts: beforeProducts + 1, createdPackages: 2 };
    }

    if (beforeProducts > 0 && beforePackages === 0) {
      const prod = await this.productsRepo.findOne({ where: { tenantId: this.PSEUDO_TENANT } as any });
      if (prod) {
        for (let i = 1; i <= 2; i++) {
          const pkg = this.packagesRepo.create({
            tenantId: this.PSEUDO_TENANT,
            name: 'Backfill Package ' + i,
            basePrice: 5 * i,
            capital: 5 * i,
            isActive: true,
            publicCode: null,
          } as any);
          (pkg as any).product = prod;
          await this.packagesRepo.save(pkg as any);
        }
        return { packagesBackfilled: true, beforeProducts, beforePackages, createdPackages: 2 };
      }
    }

    return { noOp: true, beforeProducts, beforePackages };
  }

  @Get('status')
  async status() {
    return {
      products: await this.productsRepo.count(),
      packages: await this.packagesRepo.count(),
    };
  }

  @Post('repair')
  @Get('repair')
  async repair() {
    return this.sync();
  }
}