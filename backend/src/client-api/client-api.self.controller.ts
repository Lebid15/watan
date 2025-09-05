import { Controller, Post, UseGuards, Req, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as crypto from 'crypto';

function hexToken(len = 40) { return crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0,len); }

// Self-service endpoints for any authenticated user within a tenant to manage own API token.
@ApiExcludeController()
@Controller('/api/user/client-api')
@UseGuards(JwtAuthGuard)
export class ClientApiSelfController {
  constructor(@InjectRepository(User) private usersRepo: Repository<User>) {}

  private async getUser(req: any): Promise<User> {
    const id = req.user?.id; if (!id) throw new Error('UNAUTH');
    const user = await this.usersRepo.findOne({ where: { id } as any });
    if (!user) throw new Error('NOT_FOUND');
    return user;
  }

  @Get('token')
  async getToken(@Req() req: any) {
    const user = await this.getUser(req);
    return {
      enabled: !!user.apiEnabled,
      revoked: !!user.apiTokenRevoked,
      hasToken: !!user.apiToken,
      lastUsedAt: user.apiLastUsedAt || null,
    };
  }

  @Post('generate')
  async generate(@Req() req: any) {
    const user = await this.getUser(req);
    const token = hexToken(40);
    user.apiToken = token;
    user.apiTokenRevoked = false;
    user.apiEnabled = true;
    await this.usersRepo.save(user);
    return { token };
  }

  @Post('rotate')
  async rotate(@Req() req: any) {
    const user = await this.getUser(req);
    const token = hexToken(40);
    user.apiToken = token;
    user.apiTokenRevoked = false;
    user.apiEnabled = true;
    await this.usersRepo.save(user);
    return { token };
  }

  @Post('revoke')
  async revoke(@Req() req: any) {
    const user = await this.getUser(req);
    user.apiTokenRevoked = true;
    await this.usersRepo.save(user);
    return { revoked: true };
  }
}
