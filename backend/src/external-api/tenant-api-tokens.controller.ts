import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantApiTokenService } from './tenant-api-tokens.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';

@Controller('/api/tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantApiTokensController {
  constructor(private service: TenantApiTokenService, @InjectRepository(User) private usersRepo: Repository<User>) {}

  private ensureOwner(req: any) {
    const role = req.user?.roleFinal || req.user?.role;
  if (role !== 'tenant_owner') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'FORBIDDEN' });
  }

  @Post('users/:id/api-tokens')
  async create(@Req() req: any, @Param('id') userId: string, @Body() body: { scopes: string[]; name?: string; expiresAt?: string; }) {
    this.ensureOwner(req);
    const tenantId = req.tenant.id;
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
  if (!user || user.tenantId !== tenantId) throw new NotFoundException({ code: 'VALIDATION_ERROR', message: 'VALIDATION_ERROR' });
  if (!user.apiEnabled) throw new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message: 'VALIDATION_ERROR' });
    return this.service.createToken(tenantId, userId, body.scopes || [], body.name, body.expiresAt ? new Date(body.expiresAt) : null);
  }

  @Get('users/:id/api-tokens')
  async list(@Req() req: any, @Param('id') userId: string) {
    this.ensureOwner(req);
    return this.service.listUserTokens(userId, req.tenant.id);
  }

  @Patch('api-tokens/:tokenId')
  async patch(@Req() req: any, @Param('tokenId') tokenId: string, @Body() body: any) {
    this.ensureOwner(req);
    return this.service.updateToken(tokenId, req.tenant.id, body);
  }

  @Delete('api-tokens/:tokenId')
  async del(@Req() req: any, @Param('tokenId') tokenId: string) {
    this.ensureOwner(req);
    return this.service.deleteToken(tokenId, req.tenant.id);
  }
}
