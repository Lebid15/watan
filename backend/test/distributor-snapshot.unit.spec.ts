import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from '../src/products/products.service';
import { Product } from '../src/products/product.entity';
import { ProductPackage } from '../src/products/product-package.entity';
import { PackagePrice } from '../src/products/package-price.entity';
import { PriceGroup } from '../src/products/price-group.entity';
import { User } from '../src/user/user.entity';
import { ProductOrder } from '../src/products/product-order.entity';
import { Currency } from '../src/currencies/currency.entity';
import { OrderDispatchLog } from '../src/products/order-dispatch-log.entity';
import { PackageRouting } from '../src/integrations/package-routing.entity';
import { PackageMapping } from '../src/integrations/package-mapping.entity';
import { PackageCost } from '../src/integrations/package-cost.entity';
import { DistributorPackagePrice, DistributorUserPriceGroup } from '../src/distributor/distributor-pricing.entities';
import { IdempotentRequest } from '../src/products/idempotent-request.entity';
import { PricingService } from '../src/products/pricing.service';
import { IntegrationsService } from '../src/integrations/integrations.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { AccountingPeriodsService } from '../src/accounting/accounting-periods.service';
import { ClientApiWebhookEnqueueService } from '../src/client-api/client-api-webhook.enqueue.service';

// Lightweight in-memory style mocks
function repoMock() { return { findOne: jest.fn(), find: jest.fn(), save: jest.fn(x=>x), create: jest.fn(x=>x), update: jest.fn(), count: jest.fn(), manager: { query: jest.fn(), transaction: async (fn:any)=> fn({ getRepository: (e:any)=> repoMock() }) } }; }

const flagTrue = jest.fn().mockReturnValue(true);
jest.mock('../src/common/feature-flags', () => ({ isFeatureEnabled: (f:string)=> true }));

describe('Distributor snapshot unit', () => {
  let service: ProductsService;
  let userRepo: any; let pkgRepo: any; let prodRepo: any; let orderRepo: any; let priceRepo: any; let distUserGroupRepo: any; let distPkgPriceRepo: any; let currencyRepo: any;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: 'IntegrationsService', useValue: { list: jest.fn(), placeOrder: jest.fn(), checkOrders: jest.fn(), get: jest.fn() } },
        { provide: getRepositoryToken(Product), useValue: (prodRepo = repoMock()) },
        { provide: getRepositoryToken(ProductPackage), useValue: (pkgRepo = repoMock()) },
        { provide: getRepositoryToken(PackagePrice), useValue: (priceRepo = repoMock()) },
        { provide: getRepositoryToken(PriceGroup), useValue: repoMock() },
  { provide: getRepositoryToken(IdempotentRequest), useValue: repoMock() },
        { provide: getRepositoryToken(User), useValue: (userRepo = repoMock()) },
        { provide: getRepositoryToken(ProductOrder), useValue: (orderRepo = repoMock()) },
        { provide: getRepositoryToken(Currency), useValue: (currencyRepo = repoMock()) },
        { provide: getRepositoryToken(OrderDispatchLog), useValue: repoMock() },
        { provide: getRepositoryToken(PackageRouting), useValue: repoMock() },
        { provide: getRepositoryToken(PackageMapping), useValue: repoMock() },
  { provide: getRepositoryToken(PackageCost), useValue: repoMock() },
        { provide: getRepositoryToken(DistributorPackagePrice), useValue: (distPkgPriceRepo = repoMock()) },
        { provide: getRepositoryToken(DistributorUserPriceGroup), useValue: (distUserGroupRepo = repoMock()) },
  { provide: IntegrationsService, useValue: { list: jest.fn(), placeOrder: jest.fn(), checkOrders: jest.fn(), get: jest.fn() }},
  { provide: NotificationsService, useValue: { orderStatusChanged: jest.fn() } },
  { provide: AccountingPeriodsService, useValue: { assertApprovedMonthOpen: jest.fn() } },
  { provide: PricingService, useValue: { getEffectiveUnitPrice: jest.fn(), validateQuantity: jest.fn(), quoteUnitOrder: jest.fn() } },
  { provide: ClientApiWebhookEnqueueService, useValue: { enqueue: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(ProductsService);
  });

  it('fills distributor snapshots with quantity & FX and stores snapshot columns', async () => {
  const distributor = { id: 'dist1', roleFinal: 'distributor', role: 'distributor', tenantId: 't1', balance: 9999, overdraftLimit: 0, preferredCurrencyCode: 'SAR', priceGroup: { id: 'pg-dist' } } as any;
  const subUser = { id: 'u2', parentUserId: 'dist1', roleFinal: 'user', role: 'user', tenantId: 't1', balance: 9999, overdraftLimit: 0, currency: { rate: 1, code: 'USD' }, preferredCurrencyCode: 'SAR' } as any;
    // Prime top-level userRepo.findOne used before transaction (line ~781) to return subUser
    userRepo.findOne.mockImplementation(async (q:any)=> {
      if (q?.where?.id === 'u2') return subUser;
      if (q?.where?.id === 'u3') return { id: 'u3', parentUserId: 'distX', roleFinal: 'user', role: 'user', tenantId: 't1', balance: 10, overdraftLimit: 0, currency: { rate:1, code:'USD' } } as any;
      return null;
    });
  // Mock package & product root lookups used by getEffectivePriceUSD
  const product = { id: 'prod', tenantId: 't1' } as any;
  const pkg = { id: 'pkg', tenantId: 't1', basePrice: 5, capital: 5, prices: [] } as any;
  prodRepo.findOne.mockResolvedValue(product);
  pkgRepo.findOne.mockResolvedValue(pkg);
  // currency repo resolves SAR rate 3.75
  currencyRepo.findOne.mockResolvedValue({ rate: 3.75 });
    const updateCalls: any[] = [];

  (service as any).ordersRepo.manager.transaction = async (fn: any) => {
      const trxCtx: any = {
        getRepository: (token: any) => {
          if (token === Product) return { findOne: async () => product };
          if (token === ProductPackage) return { findOne: async () => pkg };
          if (token === User) return { findOne: async (q:any)=> {
              if (q.where.id === 'u2') return subUser; // sub user
              if (q.where.id === 'dist1') return distributor; // parent distributor
              return null;
            }, save: async(x:any)=>x };
          if (token === ProductOrder) return {
            create: (x:any)=> x,
            save: async (o:any)=> { o.id='ord1'; return o; },
            update: jest.fn((id:any, patch:any)=> { updateCalls.push({ id, patch }); }),
          } as any;
          if (token === PackagePrice) return { findOne: async ()=> ({ price: 4 }) } as any; // distributor capital per unit
          if (token === DistributorUserPriceGroup) return { findOne: async ()=> ({ distributorPriceGroupId: 'dg1' }) } as any;
          if (token === DistributorPackagePrice) return { findOne: async ()=> ({ priceUSD: 7 }) } as any; // sell per unit
          if (token === Currency) return { findOne: async ()=> ({ rate: 3.75 }) } as any; // SAR
          return {};
        }
      };
      return fn(trxCtx);
    };

    const view = await service.createOrder({ productId: 'prod', packageId: 'pkg', quantity: 2, userId: 'u2' }, 't1');
    expect(view.quantity).toBe(2);
    // Assert update call captured with proper snapshot fields
    const patch = updateCalls.find(c=> c.id === 'ord1')?.patch || {};
    // capital per unit 4 * qty 2 = 8 ; sell per unit 7 *2 =14; profit=6; FX 3.75
    expect(patch.distributorCapitalUsdAtOrder).toBe('8.000000');
    expect(patch.distributorSellUsdAtOrder).toBe('14.000000');
    expect(patch.distributorProfitUsdAtOrder).toBe('6.000000');
    expect(patch.fxUsdToDistAtOrder).toBe('3.750000');
    expect(patch.distCurrencyCodeAtOrder).toBe('SAR');
    // Terminal status recomputation guard comment: any later status change (approved, etc.) must not alter these stored snapshot values (guard enforced in service).
  });

  it('returns 422 when distributor sell price missing', async () => {
  const subUser = { id: 'u3', parentUserId: 'distX', roleFinal: 'user', role: 'user', tenantId: 't1', balance: 100, overdraftLimit: 0, currency: { rate: 1, code: 'USD' } } as any;
    userRepo.findOne.mockImplementation(async (q:any)=> {
      if (q?.where?.id === 'u3') return subUser;
      if (q?.where?.id === 'distX') return { id: 'distX', roleFinal: 'distributor', role: 'distributor', tenantId: 't1', balance: 100, overdraftLimit: 0, priceGroup: { id: 'pg-miss' }, preferredCurrencyCode: 'USD' } as any;
      return null;
    });
  // Root lookups for getEffectivePriceUSD
  const product = { id: 'prod', tenantId: 't1' } as any;
  const pkg = { id: 'pkg', tenantId: 't1', basePrice: 5, capital: 5, prices: [] } as any;
  prodRepo.findOne.mockResolvedValue(product);
  pkgRepo.findOne.mockResolvedValue(pkg);
  currencyRepo.findOne.mockResolvedValue({ rate: 3.75 });
  (service as any).ordersRepo.manager.transaction = async (fn: any) => {
      const trxCtx: any = {
        getRepository: (token: any) => {
          if (token === Product) return { findOne: async () => product };
          if (token === ProductPackage) return { findOne: async () => pkg };
          if (token === User) return { findOne: async (q:any)=> {
              if (q.where.id === 'u3') return subUser;
              if (q.where.id === 'distX') return { id: 'distX', roleFinal: 'distributor', role: 'distributor', priceGroup: { id: 'pg-miss' }, preferredCurrencyCode: 'USD' } as any;
              return null;
            }, save: async(x:any)=>x };
          if (token === ProductOrder) return { create:(x:any)=>x, save: async(o:any)=> { o.id='ord2'; return o; }, update: jest.fn() } as any;
          if (token === PackagePrice) return { findOne: async ()=> ({ price: 4 }) } as any;
          if (token === DistributorUserPriceGroup) return { findOne: async ()=> ({ distributorPriceGroupId: 'dg_missing' }) } as any;
          if (token === DistributorPackagePrice) return { findOne: async ()=> null } as any; // missing price -> 422
          if (token === Currency) return { findOne: async ()=> ({ rate: 3.75 }) } as any;
          return {};
        }
      };
      return fn(trxCtx);
    };
    await expect(service.createOrder({ productId: 'prod', packageId: 'pkg', quantity: 1, userId: 'u3' }, 't1'))
      .rejects.toMatchObject({ status: 422 });
  });
});
