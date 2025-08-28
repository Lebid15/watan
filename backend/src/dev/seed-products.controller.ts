import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';

/**
 * POST /api/dev/seed-products
 * Creates demo products with packages (developer only; simple shared pseudo-tenant).
 */
@Controller('dev/seed-products')
export class DevSeedProductsController {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(ProductPackage) private packagesRepo: Repository<ProductPackage>,
  ) {}

  @Post()
  async seed(@Body('secret') secret?: string) {
    // Optional simple guard (can be replaced by RolesGuard if auth context available)
    if (process.env.NODE_ENV === 'production' && secret && secret !== process.env.SEED_SECRET) {
      throw new UnauthorizedException('Bad seed secret');
    }
    const pseudoTenant = '00000000-0000-0000-0000-000000000000';
    const existing = await this.productsRepo.count();
    const createdIds: string[] = [];
    if (existing > 0) {
      return { skipped: true, existing };
    }
    const specs = [
      { name: 'Seed Product A', packages: [ { name: 'A1', code: 101 }, { name: 'A2', code: null } ] },
      { name: 'Seed Product B', packages: [ { name: 'B1', code: 201 }, { name: 'B2', code: 202 }, { name: 'B3', code: null } ] },
      { name: 'Seed Product C', packages: [ { name: 'C1', code: null }, { name: 'C2', code: 301 } ] },
    ];
    for (const spec of specs) {
      const prod = await this.productsRepo.save(this.productsRepo.create({
        name: spec.name,
        description: 'Seed demo',
        tenantId: pseudoTenant,
        isActive: true,
        useCatalogImage: true,
      }) as any);
      createdIds.push(prod.id);
      for (const p of spec.packages) {
        await this.packagesRepo.save(this.packagesRepo.create({
          id: randomUUID(),
          product: prod,
          tenantId: pseudoTenant,
          name: p.name,
          basePrice: 10,
          capital: 10,
          isActive: true,
          publicCode: p.code,
        }) as any);
      }
    }
    const totalProducts = await this.productsRepo.count();
    const totalPackages = await this.packagesRepo.count();
    return { createdProducts: specs.length, createdIds, totalProducts, totalPackages };
  }
}
