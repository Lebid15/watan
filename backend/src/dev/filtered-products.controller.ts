import { Controller, Post, Get } from '@nestjs/common';
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
    // Diagnostics: counts before
    const beforeProducts = await this.productsRepo.count();
    const beforePackages = await this.packagesRepo.count();
    // Extra diagnostics: check presence of catalog tables
    let catalogDiag: any = {};
    try {
      const tables = await this.productsRepo.manager.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'catalog_%' ORDER BY 1`);
      const catProdCnt = await this.productsRepo.manager.query(`SELECT COUNT(*)::int AS c FROM catalog_product` ).catch(()=>[{c:-1}]);
      const catPkgCnt = await this.productsRepo.manager.query(`SELECT COUNT(*)::int AS c FROM catalog_package` ).catch(()=>[{c:-1}]);
      catalogDiag = { tables: tables.map((t:any)=>t.table_name), catalog_product: catProdCnt[0]?.c, catalog_package: catPkgCnt[0]?.c };
    } catch(e:any) {
      catalogDiag = { error: e?.message || String(e) };
    }
    // 1. Fetch catalog products with their packages count >1
    const rows: Array<{ id: string; name: string; pkg_count: number }> = await this.productsRepo.manager.query(`
      SELECT cp.id, COALESCE(cp.name, 'Catalog Product') as name, COUNT(cpk.id) as pkg_count
      FROM catalog_product cp
      LEFT JOIN catalog_package cpk ON cpk."catalogProductId" = cp.id
      GROUP BY cp.id
      HAVING COUNT(cpk.id) > 1
      ORDER BY cp.created_at DESC NULLS LAST
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
    // Fallback seeding if no catalog rows matched AND database empty
    if (rows.length === 0 && beforeProducts === 0) {
      const demo = this.productsRepo.create({
        name: 'Demo Product',
        description: 'Fallback demo product (no catalog data found)',
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
          publicCode: null,
        } as any);
        await this.packagesRepo.save(pkg as any);
      }
      return {
        catalogProducts: 0,
        createdProducts,
        createdPackages,
        fallbackSeeded: true,
        beforeProducts,
        beforePackages,
        afterProducts: beforeProducts + 1,
        message: 'No catalog data -> seeded demo product',
      };
    }

    const afterProducts = await this.productsRepo.count();
    const afterPackages = await this.packagesRepo.count();
    return {
      catalogProductsMatched: rows.length,
      createdProducts,
      createdPackages,
      beforeProducts,
      beforePackages,
      afterProducts,
      afterPackages,
      catalogDiag,
    };
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