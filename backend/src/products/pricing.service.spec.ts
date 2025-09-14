import { setTestPriceDecimals } from '../../test/utils/price-decimals.helpers';
setTestPriceDecimals(4);
import { Test } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductPackage } from './product-package.entity';
import { User } from '../user/user.entity';
import { PackagePrice } from './package-price.entity';
import { Product } from './product.entity';

// Simple in-memory fakes
const makeRepo = <T extends object>() => {
  const data: any[] = [];
  return {
    findOne: jest.fn(async (opts: any) => {
      if (opts?.where?.id) return data.find(r => r.id === opts.where.id) || null;
      return null;
    }),
    save: jest.fn(async (e: any) => { const idx = data.findIndex(d => d.id === e.id); if (idx >= 0) data[idx] = e; else data.push(e); return e; }),
    _data: data,
  } as any;
};

describe('PricingService', () => {
  let service: PricingService;
  let packagesRepo: any;
  let usersRepo: any;
  let packagePriceRepo: any;
  let productsRepo: any;

  const tenantId = 't1';
  const userId = 'u1';
  const priceGroupId = 'pg1';
  const packageId = 'pk1';
  const productId = 'prd1';

  beforeEach(async () => {
    packagesRepo = makeRepo<ProductPackage>();
    usersRepo = makeRepo<User>();
    packagePriceRepo = makeRepo<PackagePrice>();
    productsRepo = makeRepo<Product>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: getRepositoryToken(ProductPackage), useValue: packagesRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(PackagePrice), useValue: packagePriceRepo },
        { provide: getRepositoryToken(Product), useValue: productsRepo },
      ],
    }).compile();

    service = moduleRef.get(PricingService);

    // seed product, package, user
    const product: any = { id: productId, tenantId, supportsCounter: true };
    productsRepo._data.push(product);
    const pkg: any = { id: packageId, tenantId, type: 'unit', baseUnitPrice: 1.1000, product, minUnits: 2, maxUnits: 10, step: 0.5, capital: 0.4000, prices: [] };
    packagesRepo._data.push(pkg);
    const user: any = { id: userId, tenantId, priceGroup: { id: priceGroupId } };
    usersRepo._data.push(user);
  });

  test('returns baseUnitPrice (no override logic anymore)', async () => {
    const p = await service.getEffectiveUnitPrice({ tenantId, userId, packageId });
    expect(p).toBe('1.1000');
  });

  test('rejects when product.supportsCounter=false → ERR_UNIT_NOT_SUPPORTED', async () => {
    packagesRepo._data[0].product.supportsCounter = false;
    await expect(service.getEffectiveUnitPrice({ tenantId, userId, packageId })).rejects.toThrow('ERR_UNIT_NOT_SUPPORTED');
  });

  test('rejects when package.type!=unit → ERR_UNIT_NOT_SUPPORTED', async () => {
    packagesRepo._data[0].type = 'fixed';
    await expect(service.getEffectiveUnitPrice({ tenantId, userId, packageId })).rejects.toThrow('ERR_UNIT_NOT_SUPPORTED');
  });

  test('quantity below min → ERR_QTY_BELOW_MIN', () => {
    expect(() => service.validateQuantity({ quantity: '1.5', minUnits: '2', step: '0.5' })).toThrow('ERR_QTY_BELOW_MIN');
  });

  test('quantity above max → ERR_QTY_ABOVE_MAX', () => {
    expect(() => service.validateQuantity({ quantity: '11', maxUnits: '10' })).toThrow('ERR_QTY_ABOVE_MAX');
  });

  test('step match fractional (step=0.5 qty=2.5)', () => {
    expect(() => service.validateQuantity({ quantity: '2.5', minUnits: '2', step: '0.5' })).not.toThrow();
  });

  test('step mismatch → ERR_QTY_STEP_MISMATCH', () => {
    expect(() => service.validateQuantity({ quantity: '2.6', minUnits: '2', step: '0.5' })).toThrow('ERR_QTY_STEP_MISMATCH');
  });

  test('missing baseUnitPrice → ERR_UNIT_PRICE_MISSING', async () => {
    packagesRepo._data[0].baseUnitPrice = null;
    await expect(service.getEffectiveUnitPrice({ tenantId, userId, packageId })).rejects.toThrow('ERR_UNIT_PRICE_MISSING');
  });

  test('quote uses baseUnitPrice', async () => {
    const quote = await service.quoteUnitOrder({ tenantId, userId, packageId, quantity: '2.5' });
    expect(quote.unitPriceApplied).toBe('1.1000');
    expect(quote.sellPrice).toBe('2.7500');
  });
});
