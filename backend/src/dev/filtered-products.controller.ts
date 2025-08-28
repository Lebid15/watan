import { Controller, Post, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';

/**
 * Dev endpoint (catalog disabled): previously imported from catalog tables.
 * Now: if DB empty seeds one demo product; otherwise no-op and reports counts.
 */
@Controller('dev/filtered-products-sync')
export class DevFilteredProductsController {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(ProductPackage) private packagesRepo: Repository<ProductPackage>,
  ) {}

  @Post()
  async sync() {
    const pseudoTenant = '00000000-0000-0000-0000-000000000000';
    const beforeProducts = await this.productsRepo.count();
    const beforePackages = await this.packagesRepo.count();
    if (beforeProducts === 0) {
      const demo = this.productsRepo.create({
        name: 'Demo Product',
        description: 'Dev demo product (no catalog)',
        tenantId: pseudoTenant,
        isActive: true,
        useCatalogImage: true,
      } as any);
      const savedDemo = await this.productsRepo.save(demo as any);
      for (let i = 1; i <= 2; i++) {
        const pkg = this.packagesRepo.create({
          product: savedDemo,
          tenantId: pseudoTenant,
          name: `Demo Package ${i}`,
          basePrice: 10 * i,
          capital: 10 * i,
          isActive: true,
          publicCode: i === 1 ? 1000 : null,
        } as any);
        await this.packagesRepo.save(pkg as any);
      }
      return { fallbackSeeded: true, beforeProducts, beforePackages, afterProducts: beforeProducts + 1 };
    }
    return { noOp: true, beforeProducts, beforePackages };
  }

  @Get('status')
  async status() {
    const beforeProducts = await this.productsRepo.count();
    const beforePackages = await this.packagesRepo.count();
    const sample = await this.productsRepo.find({ take: 3, relations: ['packages'] });
    return {
      products: beforeProducts,
      packages: beforePackages,
      sample: sample.map(p => ({ id: p.id, name: p.name, packages: p.packages.length })),
    };
  }
}