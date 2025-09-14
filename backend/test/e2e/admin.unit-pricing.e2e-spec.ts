// Ensure tests run with 4 decimal precision so inputs like 0.0500 validate
process.env.PRICE_DECIMALS = '4';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';
import { ProductsAdminController } from '../../src/admin/products.admin.controller';
import { Product } from '../../src/products/product.entity';
import { ProductPackage } from '../../src/products/product-package.entity';
import { PackagePrice } from '../../src/products/package-price.entity';
import { PriceGroup } from '../../src/products/price-group.entity';
import { User } from '../../src/user/user.entity';
import { Tenant } from '../../src/tenants/tenant.entity';
import { TenantDomain } from '../../src/tenants/tenant-domain.entity';
import { Currency } from '../../src/currencies/currency.entity';
import { AuditService } from '../../src/audit/audit.service';
import { ProductImageMetricsService } from '../../src/products/product-image-metrics.service';
import { WebhooksService } from '../../src/webhooks/webhooks.service';
import { ThumbnailService } from '../../src/products/thumbnail.service';
import { resetPriceDecimalsForTest } from '../../src/config/pricing.config';

// Minimal stub services where full behavior not required
class AuditServiceStub { async log() { /* noop */ } }
class MetricsStub { /* noop */ }
class WebhooksStub { postJson() { return Promise.resolve(); } }
class ThumbsStub { generate(url: string) { return { small: url, medium: url, large: url }; } }

// Simple guard override injecting admin user + tenant
class JwtAuthGuardMock {
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'admin-user', roleFinal: 'ADMIN', tenantId: 't1' };
    req.tenant = { id: 't1' };
    return true;
  }
}

describe('Admin Unit Pricing API (e2e)', () => {
  let app: INestApplication;
  let productsRepo: Repository<Product>;
  let packagesRepo: Repository<ProductPackage>;
  let priceGroupRepo: Repository<PriceGroup>;
  let priceRepo: Repository<PackagePrice>;

  let productA: Product; // supportsCounter
  let packageA1: ProductPackage; // unit
  let productB: Product; // supportsCounter=false
  let packageB1: ProductPackage; // fixed
  let groupVIP: PriceGroup;

  beforeAll(async () => {
    // Recompute pricing decimals after setting env override above
    resetPriceDecimalsForTest();
    // Ensure entity decorators that switch on this flag use sqlite-friendly column types
    process.env.TEST_DB_SQLITE = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          synchronize: true,
          autoLoadEntities: true,
        }),
        // Include User + Tenant + Currency to satisfy PriceGroup#users inverse relation
        // (User references Tenant & Currency so we register them too)
  TypeOrmModule.forFeature([Product, ProductPackage, PackagePrice, PriceGroup, User, Tenant, TenantDomain, Currency]),
      ],
      controllers: [ProductsAdminController],
      providers: [
        { provide: AuditService, useClass: AuditServiceStub },
        { provide: ProductImageMetricsService, useClass: MetricsStub },
        { provide: WebhooksService, useClass: WebhooksStub },
        { provide: ThumbnailService, useClass: ThumbsStub },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(JwtAuthGuardMock)
      .compile();

  app = moduleRef.createNestApplication();
  // Match production prefix so paths use /api/...
  app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
    await app.init();

    productsRepo = moduleRef.get(getRepositoryToken(Product));
    packagesRepo = moduleRef.get(getRepositoryToken(ProductPackage));
    priceGroupRepo = moduleRef.get(getRepositoryToken(PriceGroup));
    priceRepo = moduleRef.get(getRepositoryToken(PackagePrice));

    // Seed tenant price group
    groupVIP = await priceGroupRepo.save(priceGroupRepo.create({ name: 'VIP', tenantId: 't1' } as any)) as any;

    // Product A supports counter
    productA = await productsRepo.save(productsRepo.create({ name: 'Product A', tenantId: 't1', supportsCounter: true } as any)) as any;
  packageA1 = await packagesRepo.save(packagesRepo.create({ name: 'Pkg A1', tenantId: 't1', product: productA, type: 'unit', unitName: 'Message', unitCode: 'MSG', step: 1, minUnits: 1, maxUnits: 1000 } as any)) as any;

    // create base price row (no unit override yet)
    await priceRepo.save(priceRepo.create({ tenantId: 't1', priceGroup: groupVIP, package: packageA1, price: 10 } as any));

    // Product B does not support counter
    productB = await productsRepo.save(productsRepo.create({ name: 'Product B', tenantId: 't1', supportsCounter: false } as any)) as any;
    packageB1 = await packagesRepo.save(packagesRepo.create({ name: 'Pkg B1', tenantId: 't1', product: productB, type: 'fixed', basePrice: 5 } as any)) as any;
  });

  afterAll(async () => {
    await app.close();
  });

  const baseUrl = '/api/admin/products';

  it('GET admin price for unit package returns unit meta (no override concept)', async () => {
    const res = await request(app.getHttpServer())
      .get(`${baseUrl}/price-groups/${groupVIP.id}/package-prices`)
      .query({ packageId: packageA1.id })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.unitName).toBe('Message');
  // No baseUnitPrice now; price returned is the group row price (seeded below when we add rows)
  });

  // لم يعد هناك مسار override، لذلك اختبار PACKAGE_NOT_UNIT الخاص بالـ override أزيل.

  it('PATCH unit meta validates and persists (without baseUnitPrice)', async () => {
    const resOk = await request(app.getHttpServer())
  .patch(`${baseUrl}/packages/${packageA1.id}/unit`)
  .send({ unitName: 'Message Updated', step: '2', minUnits: '2', maxUnits: '200' })
      .expect(200);
    expect(resOk.body.ok).toBe(true);
    const res2 = await request(app.getHttpServer())
      .get(`${baseUrl}/price-groups/${groupVIP.id}/package-prices`)
      .query({ packageId: packageA1.id })
      .expect(200);
    expect(res2.body.unitName).toBe('Message Updated');
  // price group row unaffected by meta update; no baseUnitPrice field anymore
  });

  it('Fails when min>max', async () => {
    const res = await request(app.getHttpServer())
  .patch(`${baseUrl}/packages/${packageA1.id}/unit`)
  .send({ unitName: 'X', minUnits: '5', maxUnits: '2' })
      .expect(400);
    expect(res.body.message).toBe('RANGE_INVALID');
  });

  it('Fails when step<=0', async () => {
    const res = await request(app.getHttpServer())
  .patch(`${baseUrl}/packages/${packageA1.id}/unit`)
  .send({ unitName: 'X', step: '0' })
      .expect(400);
    expect(res.body.message).toBe('STEP_INVALID');
  });

  it('Multi-tenant guard: different tenant price group not found', async () => {
    // Create foreign group under another tenant
  const foreign = await priceGroupRepo.save(priceGroupRepo.create({ name: 'Foreign', tenantId: 't2' } as any)) as any;
    await request(app.getHttpServer())
      .get(`${baseUrl}/price-groups/${foreign.id}/package-prices`)
      .query({ packageId: packageA1.id })
      .expect(404); // current logic returns NotFound for group mismatch
  });

  it('Shape snapshot includes expected keys', async () => {
    const res = await request(app.getHttpServer())
      .get(`${baseUrl}/price-groups/${groupVIP.id}/package-prices`)
      .query({ packageId: packageA1.id })
      .expect(200);
    const keys = Object.keys(res.body).sort();
  const expected = ['ok','groupId','groupName','packageId','priceId','price','packageType','supportsCounter','unitName','unitCode','minUnits','maxUnits','step'];
    expected.forEach(k => expect(keys).toContain(k));
  });
});
