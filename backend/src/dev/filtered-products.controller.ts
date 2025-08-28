import { Controller, Post, Get } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
    const insertDemoPackages = async (product: Product, force = false) => {
      let created = 0;
      const errors: any[] = [];
      for (let i = 1; i <= 2; i++) {
        try {
          let exists: ProductPackage | null = null;
          if (!force) {
            exists = await this.packagesRepo.findOne({ where: { product: { id: product.id }, name: `Demo Package ${i}` } as any });
          }
          if (exists) continue;
          const pkg = this.packagesRepo.create({
            id: randomUUID(),
            product,
            tenantId: pseudoTenant,
            name: `Demo Package ${i}`,
            basePrice: 10 * i,
            capital: 10 * i,
            isActive: true,
            publicCode: null,
          } as any);
          await this.packagesRepo.save(pkg as any);
          created++;
        } catch (e: any) {
          errors.push({ i, message: e?.message, code: e?.code });
        }
      }
      return { created, errors };
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
  const { created: createdPkgs, errors } = await insertDemoPackages(savedDemo);
  return { fallbackSeeded: true, beforeProducts, beforePackages, afterProducts: beforeProducts + 1, createdPkgs, errors };
    }

    // Backfill scenario: product exists (e.g., first attempt failed mid-way) but packages missing
    if (beforeProducts > 0 && beforePackages === 0) {
      const demoExisting = await this.productsRepo.findOne({ where: { tenantId: pseudoTenant } as any });
      if (demoExisting) {
        const { created: createdPkgs, errors } = await insertDemoPackages(demoExisting, true);
        return { packagesBackfilled: true, createdPkgs, errors, beforeProducts, beforePackages };
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

  // Convenience GET variant (some users may try GET and receive 404 otherwise)
  @Get('repair')
  async repairGet() {
    return this.repair();
  }

  // LOCAL TEST ONLY (not public path list) create ad-hoc demo product with packages
  @Post('local-test-force')
  async localTestForce() {
    if (process.env.NODE_ENV === 'production') {
      return { blocked: true };
    }
    const pseudoTenant = '00000000-0000-0000-0000-000000000000';
    const p = await this.productsRepo.save(this.productsRepo.create({
      name: 'Local Test Product ' + Date.now(),
      tenantId: pseudoTenant,
      isActive: true,
      useCatalogImage: true,
    }) as any);
    for (let i = 1; i <= 2; i++) {
      await this.packagesRepo.save(this.packagesRepo.create({
        id: randomUUID(),
        product: p,
        tenantId: pseudoTenant,
        name: 'LTPK ' + i,
        basePrice: 5 * i,
        capital: 5 * i,
        isActive: true,
        publicCode: null,
      }) as any);
    }
    const withPkgs = await this.productsRepo.findOne({ where: { id: p.id } as any, relations: ['packages'] });
    return { created: p.id, packages: withPkgs?.packages?.length };
  }
}