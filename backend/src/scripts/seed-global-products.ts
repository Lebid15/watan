import { DataSource } from 'typeorm';
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';

export async function seedGlobalProducts(dataSource: DataSource) {
  const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000000';
  
  const productsRepo = dataSource.getRepository(Product);
  const packagesRepo = dataSource.getRepository(ProductPackage);
  
  const existingCount = await productsRepo.count({ where: { tenantId: DEV_TENANT_ID } as any });
  if (existingCount > 0) {
    console.log(`Global products already exist (${existingCount}), skipping seed`);
    return;
  }
  
  const sampleProducts = [
    { 
      name: 'بطاقة جوجل بلاي', 
      packages: [
        { name: '10 دولار', publicCode: 1001, basePrice: 10, capital: 9 },
        { name: '25 دولار', publicCode: 1002, basePrice: 25, capital: 23 },
        { name: '50 دولار', publicCode: 1003, basePrice: 50, capital: 48 }
      ] 
    },
    { 
      name: 'بطاقة آيتونز', 
      packages: [
        { name: '15 دولار', publicCode: 1004, basePrice: 15, capital: 14 },
        { name: '30 دولار', publicCode: 1005, basePrice: 30, capital: 28 }
      ] 
    },
    { 
      name: 'شحن موبايلي', 
      packages: [
        { name: '20 ريال', publicCode: 1006, basePrice: 20, capital: 19 },
        { name: '50 ريال', publicCode: 1007, basePrice: 50, capital: 48 },
        { name: '100 ريال', publicCode: 1008, basePrice: 100, capital: 96 }
      ] 
    },
    { 
      name: 'شحن STC', 
      packages: [
        { name: '25 ريال', publicCode: 1009, basePrice: 25, capital: 24 },
        { name: '75 ريال', publicCode: 1010, basePrice: 75, capital: 72 }
      ] 
    },
    { 
      name: 'بطاقة أمازون', 
      packages: [
        { name: '20 دولار', publicCode: 1011, basePrice: 20, capital: 19 },
        { name: '40 دولار', publicCode: 1012, basePrice: 40, capital: 38 }
      ] 
    }
  ];
  
  for (const productData of sampleProducts) {
    const product = new Product();
    product.tenantId = DEV_TENANT_ID;
    product.name = productData.name;
    product.isActive = true;
    const savedProduct = await productsRepo.save(product);
    
    for (const pkgData of productData.packages) {
      const pkg = new ProductPackage();
      pkg.tenantId = DEV_TENANT_ID;
      pkg.name = pkgData.name;
      pkg.publicCode = pkgData.publicCode;
      pkg.basePrice = pkgData.basePrice;
      pkg.capital = pkgData.capital;
      pkg.isActive = true;
      pkg.product = savedProduct;
      await packagesRepo.save(pkg);
    }
  }
  
  console.log(`Seeded ${sampleProducts.length} global products with packages`);
}
