// src/auth/passkeys/passkeys.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PasskeysService } from './passkeys.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { AuthService } from '../auth.service';
import { UserService } from '../../user/user.service';
import { AuditService } from '../../audit/audit.service';

@Controller('auth/passkeys')
export class PasskeysController {
  constructor(
    private svc: PasskeysService,
    private auth: AuthService,
    private users: UserService,
    private audit: AuditService,
  ) {}

  // List current user's registered passkeys
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: any) {
    return this.svc.list(req.user.sub);
  }

  // Registration (get options)
  @UseGuards(JwtAuthGuard)
  @Post('options/register')
  async optionsRegister(@Req() req: any, @Body() body: { label?: string }) {
    const label = (body?.label || '').trim() || undefined;
    throw new BadRequestException('Passkeys disabled - use TOTP authentication');
  }

  // Debug (temporary)
  @UseGuards(JwtAuthGuard)
  @Get('_debug')
  async debug() {
    return {
      enabled: (this.svc as any).enabled,
      rpId: (this.svc as any).rpId,
      nodeEnv: process.env.NODE_ENV,
      hasRP: !!process.env.RP_ID,
    };
  }

  // Finish registration
  @UseGuards(JwtAuthGuard)
  @Post('register')
  async register(@Req() req: any, @Body() body: any) {
    throw new BadRequestException('Passkeys disabled - use TOTP authentication');
  }

  // Get authentication (login) options (no JWT)
  // Wildcard logic:
  // - tenantId key NOT PRESENT => search any tenant (findAnyByEmailOrUsername)
  // - tenantId: null => owner / global scope
  // - tenantId: value => specific tenant
  @Post('options/login')
  async optionsLogin(@Body() body: { emailOrUsername: string; tenantId?: string | null }) {
    if (!body?.emailOrUsername) throw new BadRequestException('emailOrUsername required');

    const hasTenantId = Object.prototype.hasOwnProperty.call(body, 'tenantId');
    const tenantId = hasTenantId ? (body.tenantId ?? null) : undefined;

    let user;
    if (tenantId === undefined) {
      // wildcard across all tenants / owner
      user = await this.users.findAnyByEmailOrUsername(body.emailOrUsername);
    } else if (tenantId === null) {
      user = await this.users.findByEmail(body.emailOrUsername, null, []);
      if (!user) user = await this.users.findByUsername(body.emailOrUsername, null, []);
      if (!user) user = await this.users.findOwnerByEmailOrUsername(body.emailOrUsername, []);
    } else {
      user = await this.users.findByEmail(body.emailOrUsername, tenantId, []);
      if (!user) user = await this.users.findByUsername(body.emailOrUsername, tenantId, []);
    }

    if (!user) throw new NotFoundException('User not found');

    throw new BadRequestException('Passkeys disabled - use TOTP authentication');
  }

  // Finish authentication (login) with passkey
  @Post('login')
  async login(
    @Req() req: any,
    @Body() body: { emailOrUsername: string; tenantId?: string | null; response: any; challengeRef: string },
  ) {
    if (!body?.emailOrUsername || !body?.response || !body?.challengeRef) {
      throw new BadRequestException('Missing fields');
    }

    const hasTenantId = Object.prototype.hasOwnProperty.call(body, 'tenantId');
    const tenantId = hasTenantId ? (body.tenantId ?? null) : undefined;

    let user;
    if (tenantId === undefined) {
      user = await this.users.findAnyByEmailOrUsername(body.emailOrUsername, ['priceGroup']);
    } else if (tenantId === null) {
      user = await this.users.findByEmail(body.emailOrUsername, null, ['priceGroup']);
      if (!user) user = await this.users.findByUsername(body.emailOrUsername, null, ['priceGroup']);
      if (!user) user = await this.users.findOwnerByEmailOrUsername(body.emailOrUsername, ['priceGroup']);
    } else {
      user = await this.users.findByEmail(body.emailOrUsername, tenantId, ['priceGroup']);
      if (!user) user = await this.users.findByUsername(body.emailOrUsername, tenantId, ['priceGroup']);
    }

    if (!user) throw new NotFoundException('User not found');

    throw new BadRequestException('Passkeys disabled - use TOTP authentication');
  }

  // Delete a registered passkey
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.svc.delete(req.user.sub, id);
  }
}
