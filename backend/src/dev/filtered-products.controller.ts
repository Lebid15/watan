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

    // Helper to insert demo packages (publicCode kept NULL to avoid uniqueness conflicts in prod data)
    const insertDemoPackages = async (product: Product) => {
      let created = 0;
      for (let i = 1; i <= 2; i++) {
        const exists = await this.packagesRepo.findOne({ where: { product: { id: product.id }, name: `Demo Package ${i}` } as any });
        if (exists) continue;
        const pkg = this.packagesRepo.create({
          product,
          tenantId: pseudoTenant,
          name: `Demo Package ${i}`,
          basePrice: 10 * i,
          capital: 10 * i,
          isActive: true,
          publicCode: null, // null => let future manual assignment happen without conflicts
        } as any);
        try {
          await this.packagesRepo.save(pkg as any);
          created++;
        } catch (e: any) {
          // swallow unique errors or others and continue; provide minimal debug info
          // (we don't throw to keep idempotency)
        }
      }
      return created;
    };

    if (beforeProducts === 0) {
      const demo = this.productsRepo.create({
        name: 'Demo Product',
        description: 'Dev demo product (no catalog)',
        tenantId: pseudoTenant,
        isActive: true,
        useCatalogImage: true,
      } as any);
      const savedDemo = await this.productsRepo.save(demo as any);
      const createdPkgs = await insertDemoPackages(savedDemo);
      return { fallbackSeeded: true, beforeProducts, beforePackages, afterProducts: beforeProducts + 1, createdPkgs };
    }

    // Backfill scenario: product exists (e.g., first attempt failed mid-way) but packages missing
    if (beforeProducts > 0 && beforePackages === 0) {
      const demoExisting = await this.productsRepo.findOne({ where: { tenantId: pseudoTenant, name: 'Demo Product' } as any });
      if (demoExisting) {
        const createdPkgs = await insertDemoPackages(demoExisting);
        return { packagesBackfilled: true, createdPkgs, beforeProducts, beforePackages };
      }
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

  // Optional manual repair hook: POST /api/dev/filtered-products-sync/repair
  // Re-runs sync logic if packages are missing (without creating extra products)
  @Post('repair')
  async repair() {
    const beforeProducts = await this.productsRepo.count();
    const beforePackages = await this.packagesRepo.count();
    const res = await this.sync();
    return { beforeProducts, beforePackages, result: res };
  }
}