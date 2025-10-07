// src/auth/auth.module.ts
import { jwtConstants } from './constants';
import { Module } from '@nestjs/common';
import { RateLimiterRegistry, RateLimitGuard } from '../common/rate-limit.guard';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';  // تأكد من هذا السطر
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../user/user.entity';
import { AuthToken } from './auth-token.entity';
import { AuthTokenService } from './auth-token.service';
import { TotpService } from './totp/totp.service';
import { TotpController } from './totp/totp.controller';
import { TotpCredential } from './totp/totp-credential.entity';
import { RecoveryCode } from './totp/recovery-code.entity';
import { AuditModule } from '../audit/audit.module';
import { EmailService } from '../common/email.service';
import { CurrenciesModule } from '../currencies/currencies.module';

@Module({
  imports: [
    UserModule,  // مهم جداً: إضافة UserModule هنا ليتمكن AuthService من استخدام UserService
    PassportModule,
  // ✅ نضيف مستودع Tenant هنا حتى نسمح لـ AuthController بالبحث بالـ tenantCode
  TypeOrmModule.forFeature([Tenant, User, AuthToken, TotpCredential, RecoveryCode]),
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '1d' },
    }),
  AuditModule,
  CurrenciesModule,
  ],
  providers: [AuthService, JwtStrategy, AuthTokenService, TotpService, RateLimiterRegistry, RateLimitGuard, EmailService],
  controllers: [AuthController, TotpController],
  exports: [AuthService, TotpService, JwtModule],
})
export class AuthModule {}
