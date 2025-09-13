import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from '../products.service';
import { Product } from '../product.entity';
import { ProductPackage } from '../product-package.entity';
import { PackagePrice } from '../package-price.entity';
import { PriceGroup } from '../price-group.entity';
import { IdempotentRequest } from '../idempotent-request.entity';
import { PricingService } from '../pricing.service';
import { User } from '../../user/user.entity';
import { ProductOrder } from '../product-order.entity';
import { Currency } from '../../currencies/currency.entity';
import { OrderDispatchLog } from '../order-dispatch-log.entity';
import { PackageRouting } from '../../integrations/package-routing.entity';
import { PackageMapping } from '../../integrations/package-mapping.entity';
import { PackageCost } from '../../integrations/package-cost.entity';
import {
  DistributorPackagePrice,
  DistributorUserPriceGroup,
} from '../../distributor/distributor-pricing.entities';
import { NotificationsService } from '../../notifications/notifications.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { AccountingPeriodsService } from '../../accounting/accounting-periods.service';
import { ClientApiWebhookEnqueueService } from '../../client-api/client-api-webhook.enqueue.service';

describe('ProductsService - getUsersPriceGroups Optimization', () => {
  let service: ProductsService;
  let priceGroupsRepo: Repository<PriceGroup>;

  const mockQueryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PricingService, useValue: { getEffectiveUnitPrice: jest.fn(), validateQuantity: jest.fn(), quoteUnitOrder: jest.fn() } },
        { provide: ClientApiWebhookEnqueueService, useValue: { enqueue: jest.fn() } },
        {
          provide: getRepositoryToken(Product),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProductPackage),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(IdempotentRequest),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(PackagePrice),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(PriceGroup),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { count: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProductOrder),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(DistributorPackagePrice),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(DistributorUserPriceGroup),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Currency),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(OrderDispatchLog),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(PackageRouting),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(PackageMapping),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(PackageCost),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { sendNotification: jest.fn() },
        },
        {
          provide: IntegrationsService,
          useValue: { checkOrders: jest.fn() },
        },
        {
          provide: AccountingPeriodsService,
          useValue: { getCurrentPeriod: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    priceGroupsRepo = module.get<Repository<PriceGroup>>(
      getRepositoryToken(PriceGroup),
    );
  });

  it('should optimize getUsersPriceGroups to use single query', async () => {
    const tenantId = 'test-tenant-id';
    const mockResult = [
      { id: 'group1', name: 'Group 1', usersCount: '5' },
      { id: 'group2', name: 'Group 2', usersCount: '3' },
      { id: 'group3', name: 'Group 3', usersCount: '0' },
    ];

    mockQueryBuilder.getRawMany.mockResolvedValue(mockResult);

    const result = await service.getUsersPriceGroups(tenantId);

    expect(priceGroupsRepo.createQueryBuilder).toHaveBeenCalledWith('pg');
    expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith(
      'users',
      'u',
      'u."priceGroupId" = pg.id AND u."tenantId" = :tenantId',
    );
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('pg.id', 'id');
    expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('pg.name', 'name');
    expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
      'COUNT(u.id)',
      'usersCount',
    );
    expect(mockQueryBuilder.where).toHaveBeenCalledWith(
      'pg."tenantId" = :tenantId',
    );
    expect(mockQueryBuilder.setParameter).toHaveBeenCalledWith(
      'tenantId',
      tenantId,
    );
    expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith('pg.id, pg.name');

    expect(result).toEqual([
      { id: 'group1', name: 'Group 1', usersCount: 5 },
      { id: 'group2', name: 'Group 2', usersCount: 3 },
      { id: 'group3', name: 'Group 3', usersCount: 0 },
    ]);
  });

  it('should handle empty results correctly', async () => {
    const tenantId = 'test-tenant-id';
    mockQueryBuilder.getRawMany.mockResolvedValue([]);

    const result = await service.getUsersPriceGroups(tenantId);

    expect(result).toEqual([]);
  });

  it('should handle invalid usersCount values', async () => {
    const tenantId = 'test-tenant-id';
    const mockResult = [
      { id: 'group1', name: 'Group 1', usersCount: 'invalid' },
      { id: 'group2', name: 'Group 2', usersCount: null },
    ];

    mockQueryBuilder.getRawMany.mockResolvedValue(mockResult);

    const result = await service.getUsersPriceGroups(tenantId);

    expect(result).toEqual([
      { id: 'group1', name: 'Group 1', usersCount: 0 },
      { id: 'group2', name: 'Group 2', usersCount: 0 },
    ]);
  });
});
