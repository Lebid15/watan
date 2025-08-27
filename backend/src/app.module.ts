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
import { CurrenciesModule } from './currencies/currencies.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PaymentsModule } from './payments/payments.module';
import { CodesModule } from './codes/codes.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuditModule } from './audit/audit.module';
import { DistributorPricingModule } from './distributor/distributor-pricing.module';
import { ExternalApiModule } from './external-api/external-api.module';
import { BillingModule } from './billing/billing.module';

import { Tenant } from './tenants/tenant.entity';
import { TenantDomain } from './tenants/tenant-domain.entity';
import { ProductImageMetricsSnapshot } from './products/product-image-metrics-snapshot.entity';
import { TenantContextMiddleware } from './tenants/tenant-context.middleware';
import { HealthController } from './health/health.controller';
import { MetricsController } from './health/metrics.controller';
import { TenantGuard } from './tenants/tenant.guard';
import { BillingGuard } from './billing/billing.guard';
import { FinalRolesGuard } from './common/authz/roles';
import { TenantMoneyDisplayInterceptor } from './common/interceptors/tenant-money-display.interceptor';
import { RateLimiterRegistry, RateLimitGuard } from './common/rate-limit.guard';
import { ErrorsModule } from './dev/errors.module';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './dev/all-exceptions.filter';
import { SchemaGuardService } from './infrastructure/schema/schema-guard.service';

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
        const isProd = explicitProd || !runningTs; // treat compiled runtime as production even if NODE_ENV missing

        if (!explicitProd && !runningTs) {
          // Helpful hint once.
          console.warn('[TypeORM] NODE_ENV not set to production; inferring production because running from dist.');
        }

        // Auto SSL only when not localhost
        let needSsl = isProd;
        try {
          const u = new URL(databaseUrl);
            if (['localhost', '127.0.0.1'].includes(u.hostname)) needSsl = false;
        } catch (_) {}

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
  ErrorsModule,
  TypeOrmModule.forFeature([Tenant, TenantDomain, ProductImageMetricsSnapshot]),
  ],
  controllers: [HealthController, MetricsController],
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
