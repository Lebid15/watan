import { Controller, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';

/**
 * Dev endpoint: sync filtered catalog products (only those having >1 catalog packages)
 * into platform products (global pseudo tenant) if not already present.
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
    // 1. Fetch catalog products with their packages count >1
    const rows: Array<{ id: string; name: string; pkg_count: number }> = await this.productsRepo.manager.query(`
      SELECT cp.id, COALESCE(cp.name, 'Catalog Product') as name, COUNT(cpk.id) as pkg_count
      FROM catalog_product cp
      LEFT JOIN catalog_package cpk ON cpk."catalogProductId" = cp.id
      GROUP BY cp.id
      HAVING COUNT(cpk.id) > 1
      ORDER BY cp.created_at DESC
      LIMIT 500;
    `);

    let createdProducts = 0;
    let createdPackages = 0;
    for (const row of rows) {
      // Check existence by catalogProductId
      const existing = await this.productsRepo.findOne({ where: { catalogProductId: row.id } as any, relations: ['packages'] });
      let productEntity: Product;
      if (!existing) {
        const draft = this.productsRepo.create({
          name: row.name,
          description: 'Imported from catalog (auto-sync)',
          tenantId: pseudoTenant,
          isActive: true,
          useCatalogImage: true,
          catalogProductId: row.id,
        } as any);
  productEntity = await this.productsRepo.save(draft as any) as any;
        createdProducts++;
        productEntity.packages = [];
      } else {
        productEntity = existing;
      }
      // Fetch catalog packages for this catalog product
      const catPkgs: Array<{ id: string; linkCode: string | null; name: string | null; base_price: number | null }> = await this.productsRepo.manager.query(
        `SELECT id, "linkCode" as "linkCode", name, COALESCE(base_price,0) as base_price FROM catalog_package WHERE "catalogProductId" = $1`,
        [row.id],
      );
      for (const c of catPkgs) {
        const exists = (productEntity.packages || []).find(p => p.name === c.name);
        if (exists) continue;
        const pkg = this.packagesRepo.create({
          product: productEntity,
          tenantId: productEntity.tenantId,
          name: c.name || 'Package',
          basePrice: c.base_price || 0,
          capital: c.base_price || 0,
          isActive: true,
          publicCode: null,
          catalogLinkCode: c.linkCode,
        } as any);
        await this.packagesRepo.save(pkg);
        createdPackages++;
      }
    }
    return { catalogProducts: rows.length, createdProducts, createdPackages };
  }
}