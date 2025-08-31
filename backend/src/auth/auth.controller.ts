// src/auth/auth.controller.ts
import { Controller, Post, Body, BadRequestException, UnauthorizedException, UseGuards, Req, ForbiddenException, ConflictException, NotFoundException, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../user/user.entity';
// ...existing code...
import * as bcrypt from 'bcrypt';
import { ApiTags, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { AuditService } from '../audit/audit.service';
import { RateLimit } from '../common/rate-limit.guard';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
// (imports already declared above for repositories)
import type { Request, Response } from 'express';

class LoginDto {
  emailOrUsername?: string;
  email?: string;
  username?: string;
  password: string;
  tenantCode?: string; // اختياري: لتحديد المتجر عند غياب الدومين
}

class ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(Tenant) private readonly tenantsRepo: Repository<Tenant>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private tokens: AuthTokenService,
    private audit: AuditService,
    private jwt: JwtService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'تسجيل الدخول بالبريد أو اسم المستخدم' })
  @ApiResponse({ status: 201, description: 'تم تسجيل الدخول بنجاح' })
  @ApiResponse({ status: 401, description: 'بيانات غير صحيحة' })
  @ApiBody({ type: LoginDto })
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: LoginDto) {
    const emailOrUsername = body.emailOrUsername ?? body.email ?? body.username;
    if (!emailOrUsername || !body.password) {
      throw new BadRequestException('يرجى إرسال emailOrUsername أو email أو username مع password');
    }

    let tenantIdFromContext: string | null = (req as any)?.tenant?.id ?? null;
    if (!tenantIdFromContext && body.tenantCode) {
      const tenant = await this.tenantsRepo.findOne({ where: { code: body.tenantCode } });
      if (tenant && tenant.isActive) tenantIdFromContext = tenant.id;
    }
    console.log('[CTRL] /auth/login tenantFromCtx=', tenantIdFromContext, 'emailOrUsername=', emailOrUsername, 'tenantCode=', body.tenantCode);

    const user = await this.authService.validateByEmailOrUsername(
      emailOrUsername,
      body.password,
      tenantIdFromContext,
    );
    if (!user) throw new UnauthorizedException('بيانات تسجيل الدخول غير صحيحة');

    const { access_token } = await this.authService.login(user, tenantIdFromContext);
    // تعيين كوكي (دعم الواجهة بالكوكي أو بالـ Bearer). Domain من البيئة إن وجد.
    const cookieDomain = process.env.AUTH_COOKIE_DOMAIN || '.syrz1.com';
    try {
      res.cookie('auth', access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        domain: cookieDomain,
        path: '/',
        maxAge: 1000 * 60 * 60 * 12, // 12h
      });
    } catch (e) {
      console.warn('[AUTH] failed to set auth cookie:', (e as any)?.message);
    }
    return { token: access_token };
  }

  @Post('logout')
  @ApiOperation({ summary: 'تسجيل الخروج ومسح كوكي auth' })
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear the auth cookie using same attributes (domain/path) so browser actually removes it.
    const cookieDomain = process.env.AUTH_COOKIE_DOMAIN || '.syrz1.com';
    try {
      const names = ['auth', 'access_token', 'role', 'tenant_host'];
      for (const n of names) {
        // clearCookie ensures expiry header
        res.clearCookie(n, {
          httpOnly: n === 'auth',
          secure: true,
          sameSite: 'none',
          domain: cookieDomain,
          path: '/',
        });
        // Extra defensive explicit expired cookie (Safari quirk)
        res.cookie(n, '', {
          httpOnly: n === 'auth',
          secure: true,
          sameSite: 'none',
          domain: cookieDomain,
          path: '/',
          expires: new Date(0),
          maxAge: 0,
        });
      }
      console.log('[AUTH][LOGOUT] cleared cookies domain=', cookieDomain);
    } catch (e) {
      console.warn('[AUTH] failed to clear auth cookie:', (e as any)?.message);
    }
    return { ok: true };
  }

  // يسمح بإنشاء حساب مطوّر (tenantId NULL) مرة واحدة عبر سر بيئة BOOTSTRAP_DEV_SECRET.
  // الاستخدام: POST /api/auth/bootstrap-developer { secret, email, password }
  // الحماية:
  //   - رفض إذا لم يُضبط السر في البيئة.
  //   - رفض لو السر خطأ.
  //   - رفض لو حساب بنفس البريد موجود (أي دور) أو أي مطوّر موجود (حتى لا ينشئ مهاجم آخر حسابًا).
  @Post('bootstrap-developer')
  @ApiOperation({ summary: 'إنشاء حساب مطوّر عالمي عبر سر بيئة (مرة واحدة)' })
  @ApiBody({ schema: { properties: { secret: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' } }, required: ['secret','email','password'] } })
  async bootstrapDeveloper(@Body() body: { secret: string; email: string; password: string }) {
    const envSecret = process.env.BOOTSTRAP_DEV_SECRET;
    if (!envSecret) throw new ForbiddenException('Bootstrap disabled (no BOOTSTRAP_DEV_SECRET)');
    if (!body?.secret || body.secret !== envSecret) throw new ForbiddenException('Invalid secret');
    if (!body.email || !body.password) throw new BadRequestException('email & password required');
    if (body.password.length < 6) throw new BadRequestException('Weak password');

    // إن وجد أي مطوّر سابقًا نمنع الإنشاء (قابل للتعديل لو أردت السماح بعدم الحصر بالبريد)
    const existingAnyDev = await this.usersRepo.findOne({ where: { role: 'developer', tenantId: IsNull() } });
    if (existingAnyDev) throw new ConflictException('Developer already exists');

    // رفض لو البريد مستخدم بأي سياق آخر
    const existingEmail = await this.usersRepo.findOne({ where: { email: body.email } });
    if (existingEmail) throw new ConflictException('Email already in use');

    const hash = await bcrypt.hash(body.password, 10);
  const user: any = this.usersRepo.create({
      email: body.email,
      password: hash,
      role: 'developer',
      tenantId: null,
      isActive: true,
      balance: 0,
      overdraftLimit: 0,
    } as any);
  const saved = await this.usersRepo.save(user);
  return { ok: true, id: saved.id, email: saved.email, role: saved.role };
  }

  // إصدار توكن مطوّر / مرتفع الصلاحية مباشرة بدون كلمة مرور لتجاوز مشاكل إرسال JSON داخل الحاويات.
  // الاستخدام: POST /api/auth/dev-token { secret, email, tenantId? }
  // الحماية: DEV_ISSUE_SECRET في البيئة.
  @Post('dev-token')
  @ApiOperation({ summary: 'إصدار JWT للمطور مباشرة عبر سر بيئة (للاستخدام التشغيلي)' })
  @ApiBody({ schema: { properties: { secret: { type: 'string' }, email: { type: 'string' }, tenantId: { type: 'string' } }, required: ['secret','email'] } })
  async issueDevToken(@Body() body: { secret: string; email: string; tenantId?: string }) {
    const envSecret = process.env.DEV_ISSUE_SECRET;
    if (!envSecret) throw new ForbiddenException('Issuing disabled (no DEV_ISSUE_SECRET)');
    if (!body?.secret || body.secret !== envSecret) throw new ForbiddenException('Invalid secret');
    if (!body.email) throw new BadRequestException('email required');
    const user = await this.usersRepo.findOne({ where: { email: body.email } });
    if (!user) throw new NotFoundException('User not found');
    if (!(user.role === 'developer' || user.role === 'instance_owner')) {
      throw new ForbiddenException('User not elevated');
    }
    const payload: any = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: body.tenantId === undefined ? (user.tenantId ?? null) : body.tenantId || null,
    };
    const token = this.jwt.sign(payload);
    return { token, payload };
  }


  @Post('register')
  @ApiOperation({ summary: 'إنشاء حساب جديد' })
  @ApiResponse({ status: 201, description: 'تم إنشاء الحساب بنجاح' })
  async register(@Req() req: Request, @Body() body: CreateUserDto) {
    const tenantId = (req as any)?.tenant?.id;
    if (!tenantId) throw new BadRequestException('Tenant ID مفقود');
    return this.authService.register(body, tenantId);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req: any, @Body() body: ChangePasswordDto) {
    if (!body?.oldPassword || !body?.newPassword) {
      throw new BadRequestException('oldPassword و newPassword مطلوبة');
    }

    const tenantId = req?.tenant?.id || req?.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID مفقود');

    await this.authService.changePassword(
      req.user.id ?? req.user.sub,
      body.oldPassword,
      body.newPassword,
      tenantId,
    );

    return { ok: true };
  }

  @Post('assume-tenant')
  @UseGuards(JwtAuthGuard)
  async assumeTenant(@Req() req: any, @Body() body: { tenantId: string }) {
    const user = req.user;
    if (!user) throw new UnauthorizedException();
    if (!body?.tenantId) throw new BadRequestException('tenantId required');
    if (!(user.role === 'developer' || user.role === 'instance_owner')) {
      try { await this.audit.log('impersonation_denied', { actorUserId: user.id, meta: { tenantId: body.tenantId, reason: 'role_not_allowed' } }); } catch {}
      throw new ForbiddenException('Only elevated roles can impersonate');
    }
    const tenant = await this.tenantsRepo.findOne({ where: { id: body.tenantId } });
    if (!tenant || !tenant.isActive) throw new NotFoundException('Tenant not found');
    const token = await this.authService.issueImpersonationToken(user, tenant.id);
    try { await this.audit.log('impersonation_success', { actorUserId: user.id, targetTenantId: tenant.id }); } catch {}
    return { token, tenantId: tenant.id, impersonated: true, expiresIn: 1800 };
  }

  @Post('request-email-verification')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ windowMs: 10*60*1000, max: 5, id: 'emailverify' })
  async requestEmailVerification(@Req() req: any) {
    const userId = req.user.sub;
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) return { ok: true, already: true };
    const { raw, entity } = await this.tokens.create(user.id, user.tenantId ?? null, 'email_verify', 24*60*60*1000);
    // Simulate sending email by logging token (would integrate with real email service)
    console.log('[EMAIL][VERIFY] token for user', user.email, raw);
    try { await this.audit.log('email_verify_request', { actorUserId: user.id, targetUserId: user.id, targetTenantId: user.tenantId ?? null, meta: { tokenId: entity.id } }); } catch {}
    return { ok: true }; // don't leak token
  }

  @Post('verify-email')
  @RateLimit({ windowMs: 10*60*1000, max: 20, id: 'verifyemail' })
  async verifyEmail(@Body() body: { token: string }) {
    if (!body?.token) throw new BadRequestException('token required');
    const token = await this.tokens.consume(body.token, 'email_verify');
    if (!token) {
      try { await this.audit.log('email_verify_fail', { meta: { reason: 'invalid_or_expired' } }); } catch {}
      throw new BadRequestException('Invalid token');
    }
    const user = await this.usersRepo.findOne({ where: { id: token.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.emailVerified) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      await this.usersRepo.save(user);
    }
    try { await this.audit.log('email_verify_success', { actorUserId: user.id, targetUserId: user.id, targetTenantId: user.tenantId ?? null }); } catch {}
    return { ok: true };
  }

  @Post('request-password-reset')
  @RateLimit({ windowMs: 10*60*1000, max: 5, id: 'pwdresetreq' })
  async requestPasswordReset(@Body() body: { emailOrUsername: string; tenantCode?: string }) {
    if (!body?.emailOrUsername) throw new BadRequestException('emailOrUsername required');
    let tenantId: string | null = null;
    if (body.tenantCode) {
      const t = await this.tenantsRepo.findOne({ where: { code: body.tenantCode } });
      if (t) tenantId = t.id;
    }
    // Find user (tenant-specific first, then owner if tenantId null)
    let user: User | null = null;
    if (tenantId) {
      user = await this.usersRepo.findOne({ where: { email: body.emailOrUsername, tenantId } as any })
        || await this.usersRepo.findOne({ where: { username: body.emailOrUsername, tenantId } as any });
    }
    if (!user) {
      user = await this.usersRepo.findOne({ where: { email: body.emailOrUsername, tenantId: IsNull() } as any })
        || await this.usersRepo.findOne({ where: { username: body.emailOrUsername, tenantId: IsNull() } as any });
    }
    if (user) {
      const { raw, entity } = await this.tokens.create(user.id, user.tenantId ?? null, 'password_reset', 60*60*1000);
      console.log('[EMAIL][PWDRESET] token for user', user.email, raw);
      try { await this.audit.log('password_reset_request', { actorUserId: user.id, targetUserId: user.id, targetTenantId: user.tenantId ?? null, meta: { tokenId: entity.id } }); } catch {}
    }
    // Always return success to avoid user enumeration
    return { ok: true };
  }

  @Post('reset-password')
  @RateLimit({ windowMs: 10*60*1000, max: 10, id: 'pwdreset' })
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    if (!body?.token || !body?.newPassword) throw new BadRequestException('token & newPassword required');
    if (body.newPassword.length < 6) throw new BadRequestException('weak password');
    const token = await this.tokens.consume(body.token, 'password_reset');
    if (!token) {
      try { await this.audit.log('password_reset_fail', { meta: { reason: 'invalid_or_expired' } }); } catch {}
      throw new BadRequestException('Invalid token');
    }
    const user = await this.usersRepo.findOne({ where: { id: token.userId } });
    if (!user) throw new NotFoundException('User not found');
    // Reuse user service setPassword path would need tenant; just update directly with argon2 via userService? Simpler direct hash done in UserService; replicate minimal logic.
    // For consistency we mark password change via direct query to avoid more imports.
    const argon2 = require('argon2');
    user.password = await argon2.hash(body.newPassword, { type: argon2.argon2id });
    await this.usersRepo.save(user);
    try { await this.audit.log('password_reset_success', { actorUserId: user.id, targetUserId: user.id, targetTenantId: user.tenantId ?? null }); } catch {}
    return { ok: true };
  }
}
