import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as crypto from 'crypto';

function hexToken(len = 40) { return crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0,len); }

// End-user self endpoints under tenant scope (/api/tenant/client-api/users/me/...)
@ApiExcludeController()
@Controller('/api/tenant/client-api/users/me')
@UseGuards(JwtAuthGuard)
export class ClientApiMeController {
  constructor(@InjectRepository(User) private usersRepo: Repository<User>) {}

  private async me(req: any): Promise<User> {
    const id = req.user?.id; if (!id) throw new Error('UNAUTH');
    const u = await this.usersRepo.findOne({ where: { id } as any });
    if (!u) throw new Error('NOT_FOUND');
    return u;
  }

  @Get('settings')
  async getSettings(@Req() req: any) {
    const u = await this.me(req);
    return {
      allowAll: u.apiAllowAllIps !== false,
      allowIps: u.apiAllowIps || [],
      webhookUrl: u.apiWebhookUrl || null,
      enabled: !!u.apiEnabled,
      revoked: !!u.apiTokenRevoked,
      lastUsedAt: u.apiLastUsedAt || null,
      rateLimitPerMin: u.apiRateLimitPerMin || null,
      webhook: {
        enabled: !!u.apiWebhookEnabled,
        url: u.apiWebhookUrl || null,
        sigVersion: u.apiWebhookSigVersion || 'v1',
        hasSecret: !!u.apiWebhookSecret,
        lastRotatedAt: u.apiWebhookLastRotatedAt || null,
      },
    };
  }

  @Post('generate')
  async generate(@Req() req: any) {
    const u = await this.me(req);
    const token = hexToken(40);
    u.apiToken = token; u.apiTokenRevoked = false; u.apiEnabled = true;
    await this.usersRepo.save(u);
    return { token };
  }

  @Post('rotate')
  async rotate(@Req() req: any) {
    const u = await this.me(req);
    const token = hexToken(40);
    u.apiToken = token; u.apiTokenRevoked = false; u.apiEnabled = true;
    await this.usersRepo.save(u);
    return { token };
  }

  @Post('revoke')
  async revoke(@Req() req: any) {
    const u = await this.me(req);
    u.apiTokenRevoked = true;
    await this.usersRepo.save(u);
    return { revoked: true };
  }

  @Patch('settings')
  async updateSettings(@Req() req: any, @Body() body: { allowAll?: boolean; allowIps?: string[]; rateLimitPerMin?: number | null; webhookUrl?: string | null; enabled?: boolean; }) {
    const u = await this.me(req);
    if (body.allowAll !== undefined) u.apiAllowAllIps = body.allowAll;
    if (Array.isArray(body.allowIps)) u.apiAllowIps = body.allowIps.filter(ip => typeof ip === 'string' && ip.length <= 64);
    if (body.webhookUrl !== undefined) u.apiWebhookUrl = body.webhookUrl || null;
    if (body.enabled !== undefined) u.apiEnabled = body.enabled;
    if (body.rateLimitPerMin !== undefined) {
      if (body.rateLimitPerMin === null) u.apiRateLimitPerMin = null;
      else if (typeof body.rateLimitPerMin === 'number' && body.rateLimitPerMin >= 1 && body.rateLimitPerMin <= 10000) {
        u.apiRateLimitPerMin = Math.floor(body.rateLimitPerMin);
      }
    }
    await this.usersRepo.save(u);
    return { updated: true };
  }
}
