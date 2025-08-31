import { Controller, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';

@Controller('dev/seed')
export class DevSeedController {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(ProductPackage) private packagesRepo: Repository<ProductPackage>,
  ) {}

  /**
   * Creates a few sample products + packages (only if table is empty) for quick dev visualization.
   */
  @Post()
  async seed() {
  const count = await this.productsRepo.count();
    if (count > 0) {
      return { message: 'Products already exist', count };
    }
    // Create 3 products without tenant (platform owner) so they appear in fallback mode
    const prodNames = ['Test Product A', 'Test Product B', 'Test Product C'];
  const created: any[] = [];
    for (const name of prodNames) {
  const p = this.productsRepo.create({
        name,
        description: name + ' description',
        tenantId: '00000000-0000-0000-0000-000000000000', // pseudo tenant for global dev
  isActive: true,
      } as any);
  const saved = await this.productsRepo.save(p);
      created.push(saved);
    }
    // Add 2 packages per product
    for (const p of created) {
      for (let i = 1; i <= 2; i++) {
  const pkg = this.packagesRepo.create({
          tenantId: p.tenantId,
          product: p,
          name: `${p.name} - Package ${i}`,
          basePrice: 10 * i,
          capital: 10 * i,
          isActive: true,
          publicCode: null,
        } as any);
  await this.packagesRepo.save(pkg);
      }
    }
    return { message: 'Seeded', products: created.length };
  }
}