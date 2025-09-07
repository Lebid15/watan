import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { PasskeysModule } from './auth/passkeys/passkeys.module';
import { AdminModule } from './admin/admin.module';
import { ProductsModule } from './products/products.module';
import { AdminCountsController } from './admin/admin-counts.controller';
import { CurrenciesModule } from './currencies/currencies.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PaymentsModule } from './payments/payments.module';
import { CodesModule } from './codes/codes.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuditModule } from './audit/audit.module';
import { DistributorPricingModule } from './distributor/distributor-pricing.module';
import { ExternalApiModule } from './external-api/external-api.module';
import { BillingModule } from './billing/billing.module';
import { ClientApiModule } from './client-api/client-api.module';

import { Tenant } from './tenants/tenant.entity';
import { TenantDomain } from './tenants/tenant-domain.entity';
import { ProductImageMetricsSnapshot } from './products/product-image-metrics-snapshot.entity';
import { ProductOrder } from './products/product-order.entity';
import { Deposit } from './payments/deposit.entity';
import { TenantContextMiddleware } from './tenants/tenant-context.middleware';
import { HealthController } from './health/health.controller';
import { MetricsController } from './health/metrics.controller';
import { TenantGuard } from './tenants/tenant.guard';
import { BillingGuard } from './billing/billing.guard';
import { FinalRolesGuard } from './common/authz/roles';
import { TenantMoneyDisplayInterceptor } from './common/interceptors/tenant-money-display.interceptor';
import { RateLimiterRegistry, RateLimitGuard } from './common/rate-limit.guard';
import { ErrorsModule } from './dev/errors.module';
import { DevToolsModule } from './dev/dev-tools.module';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './dev/all-exceptions.filter';
import { SchemaGuardService } from './infrastructure/schema/schema-guard.service';
import { DeveloperNote } from './dev/developer-note.entity';
import { DeveloperNotesService } from './dev/developer-notes.service';
import { DeveloperNotesController } from './dev/developer-notes.controller';
import { MuhammedModule } from './muhammed/muhammed.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_DB_SQLITE === 'true';
        if (isTest) {
          return {
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            dropSchema: true,
            migrationsRun: false,
            // Reduce logging noise in tests to prevent "Cannot log after tests are done" warnings
            logging: ['error'],
          } as any;
        }

        let databaseUrl = config.get<string>('DATABASE_URL');
        if (!databaseUrl) {
          // Fallback: construct from discrete vars for local dev ergonomics
          const host = config.get<string>('DB_HOST') || 'localhost';
          const port = config.get<string>('DB_PORT') || '5432';
            const user = config.get<string>('DB_USER') || config.get<string>('DB_USERNAME') || 'postgres';
          const pass = config.get<string>('DB_PASS') || config.get<string>('DB_PASSWORD') || '';
          const db   = config.get<string>('DB_NAME') || 'watan';
          databaseUrl = `postgres://${user}${pass ? ':' + pass : ''}@${host}:${port}/${db}`;
          console.log('[TypeORM] DATABASE_URL not provided; built from parts (host=%s user=%s db=%s)', host, user, db);
        }
        console.log('Connecting to database with URL:', databaseUrl.replace(/:(?:[^:@/]+)@/, ':****@'));

        // Some deploys were running compiled JS with NODE_ENV unset -> tried to load *.ts migrations.
        // Detect runtime form: if current file ends with .ts we are in ts-node/dev; otherwise in compiled dist.
        const runningTs = __filename.endsWith('.ts');
        const explicitProd = (config.get<string>('NODE_ENV') || '').toLowerCase() === 'production';
        const forceDev = process.env.FORCE_DEV === 'true';
        const isProd = !forceDev && (explicitProd || !runningTs);
        console.log('[TypeORM] flags explicitProd=%s runningTs=%s forceDev=%s isProd=%s', explicitProd, runningTs, forceDev, isProd);
        if (forceDev) {
          console.log('[TypeORM] FORCE_DEV active -> disabling SSL and using dev-style entities/migrations.');
        }

        // Decide SSL need (disable for localhost, sslmode=disable, or forceDev)
        let needSsl = isProd;
        try {
          const u = new URL(databaseUrl);
          if (['localhost', '127.0.0.1', 'db'].includes(u.hostname)) needSsl = false;
          const params = new URLSearchParams(u.search);
          const sslMode = params.get('sslmode');
          if (['disable', 'off', 'false', '0'].includes((sslMode || '').toLowerCase())) needSsl = false;
          if (process.env.DB_DISABLE_SSL === 'true') needSsl = false;
          if (forceDev) needSsl = false;
        } catch (_) { if (forceDev) needSsl = false; }

        const autoEnv = process.env.AUTO_MIGRATIONS;
        const migrationsRun = autoEnv === 'false' ? false : (autoEnv === 'true' ? true : isProd);
        return {
          type: 'postgres',
          url: databaseUrl,
          autoLoadEntities: true,
          synchronize: false, // never auto-sync; rely on migrations
          migrations: runningTs ? ['src/migrations/*.ts'] : ['dist/migrations/*.js'],
          migrationsRun,
          ssl: needSsl ? { rejectUnauthorized: false } : false,
          extra: needSsl ? { ssl: { rejectUnauthorized: false } } : undefined,
          logging: ['error'],
        };
      },
    }),
  // Disable scheduler module when testing
  ...(process.env.NODE_ENV === 'test' ? [] : [ScheduleModule.forRoot()]),
    UserModule,
    AuthModule,
  PasskeysModule,
    AdminModule,
    ProductsModule,
    CurrenciesModule,
    PaymentsModule,
    IntegrationsModule,
    CodesModule,
    TenantsModule,
    AuditModule,
  DistributorPricingModule,
  ExternalApiModule,
  BillingModule,
  ClientApiModule,
  ErrorsModule,
  DevToolsModule,
  MuhammedModule,
  // Repositories needed directly in AppModule-level controllers (e.g., AdminCountsController)
  // Include ProductOrder + Deposit so their repositories can be injected.
  TypeOrmModule.forFeature([Tenant, TenantDomain, ProductImageMetricsSnapshot, ProductOrder, Deposit, DeveloperNote]),
  ],
  // DebugAuthController is registered inside AuthModule (avoid double registration here)
  controllers: [HealthController, MetricsController, AdminCountsController, DeveloperNotesController],
  providers: [
  { provide: APP_GUARD, useClass: TenantGuard },
  { provide: APP_GUARD, useClass: FinalRolesGuard },
  // Billing guard executes after tenant + roles to leverage tenant context & user role
  { provide: APP_GUARD, useClass: BillingGuard },
  { provide: APP_FILTER, useClass: AllExceptionsFilter },
  // Note: intercepter could also be applied conditionally at controllers; simple global registration here
  { provide: 'APP_INTERCEPTOR', useClass: TenantMoneyDisplayInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  RateLimiterRegistry,
    RateLimitGuard,
  SchemaGuardService,
  DeveloperNotesService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
