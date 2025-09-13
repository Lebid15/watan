import { Test } from '@nestjs/testing';
import { ProductsService } from '../products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductPackage } from '../product-package.entity';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { IdempotentRequest } from '../idempotent-request.entity';
import { PricingService } from '../pricing.service';
import { ClientApiWebhookEnqueueService } from '../../client-api/client-api-webhook.enqueue.service';

// Minimal mocks for required repositories (only packagesRepo used here)
function repoMock() {
  return {
    findOne: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<Repository<any>>;
}

describe('ProductsService.updatePackageCode', () => {
  let service: ProductsService;
  let packagesRepo: jest.Mocked<Repository<ProductPackage>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(ProductPackage), useValue: repoMock() },
        // Stubs for other injected repos (not exercised in this spec)
        { provide: getRepositoryToken(require('../product.entity').Product), useValue: {} },
        { provide: getRepositoryToken(require('../price-group.entity').PriceGroup), useValue: {} },
        { provide: getRepositoryToken(require('../package-price.entity').PackagePrice), useValue: {} },
  { provide: getRepositoryToken(IdempotentRequest), useValue: {} },
  { provide: getRepositoryToken(require('../product-order.entity').ProductOrder), useValue: {} },
  { provide: getRepositoryToken(require('../../user/user.entity').User), useValue: {} },
  { provide: getRepositoryToken(require('../../currencies/currency.entity').Currency), useValue: {} },
  { provide: getRepositoryToken(require('../order-dispatch-log.entity').OrderDispatchLog), useValue: {} },
  { provide: getRepositoryToken(require('../../integrations/package-routing.entity').PackageRouting), useValue: {} },
  { provide: getRepositoryToken(require('../../integrations/package-mapping.entity').PackageMapping), useValue: {} },
  { provide: getRepositoryToken(require('../../integrations/package-cost.entity').PackageCost), useValue: {} },
  { provide: getRepositoryToken(require('../../distributor/distributor-pricing.entities').DistributorPackagePrice), useValue: {} },
  { provide: getRepositoryToken(require('../../distributor/distributor-pricing.entities').DistributorUserPriceGroup), useValue: {} },
  // Unused in these tests but required by constructor injection
  { provide: require('../../integrations/integrations.service').IntegrationsService, useValue: {} },
  { provide: require('../../notifications/notifications.service').NotificationsService, useValue: {} },
  { provide: require('../../accounting/accounting-periods.service').AccountingPeriodsService, useValue: {} },
  { provide: PricingService, useValue: { getEffectiveUnitPrice: jest.fn(), validateQuantity: jest.fn(), quoteUnitOrder: jest.fn() } },
        { provide: ClientApiWebhookEnqueueService, useValue: { enqueue: jest.fn() } },
      ],
    }).compile();

    service = module.get(ProductsService);
    packagesRepo = module.get(getRepositoryToken(ProductPackage));
  });

  it('clears code when null', async () => {
    packagesRepo.findOne.mockResolvedValueOnce({ id: 'p1' } as any);
    packagesRepo.update.mockResolvedValueOnce({} as any);
    const res = await service.updatePackageCode('p1', null);
    expect(res.publicCode).toBeNull();
    expect(packagesRepo.update).toHaveBeenCalledWith({ id: 'p1' }, { publicCode: null });
  });

  it('throws NotFound when package missing', async () => {
    packagesRepo.findOne.mockResolvedValueOnce(null as any);
    await expect(service.updatePackageCode('missing', 5)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid (non-positive) code', async () => {
    packagesRepo.findOne.mockResolvedValueOnce({ id: 'p1' } as any);
    await expect(service.updatePackageCode('p1', 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets code when free', async () => {
    packagesRepo.findOne.mockResolvedValueOnce({ id: 'p1' } as any); // target package
    packagesRepo.findOne.mockResolvedValueOnce(null as any); // conflict check
    packagesRepo.update.mockResolvedValueOnce({} as any);
    const res = await service.updatePackageCode('p1', 10);
    expect(res.publicCode).toBe(10);
  });

  it('auto-increments once on conflict if next free', async () => {
    packagesRepo.findOne
      .mockResolvedValueOnce({ id: 'p1' } as any) // load package
      .mockResolvedValueOnce({ id: 'other' } as any) // first conflict on 10
      .mockResolvedValueOnce(null as any); // alt 11 free
    packagesRepo.update.mockResolvedValueOnce({} as any);
    const res = await service.updatePackageCode('p1', 10);
    expect(res.publicCode).toBe(11);
  });

  it('throws conflict if both original and alt taken', async () => {
    packagesRepo.findOne
      .mockResolvedValueOnce({ id: 'p1' } as any) // load
      .mockResolvedValueOnce({ id: 'other' } as any) // conflict original
      .mockResolvedValueOnce({ id: 'another' } as any); // alt also conflict
    await expect(service.updatePackageCode('p1', 10)).rejects.toBeInstanceOf(ConflictException);
  });
});
