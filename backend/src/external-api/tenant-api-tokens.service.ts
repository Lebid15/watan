import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { TenantApiToken } from './tenant-api-token.entity';

function sha256Hex(s: string) { return crypto.createHash('sha256').update(s).digest('hex'); }

@Injectable()
export class TenantApiTokenService {
  constructor(@InjectRepository(TenantApiToken) private repo: Repository<TenantApiToken>) {}

  generateSecret(prefixLength = 6) {
    const prefix = crypto.randomBytes(Math.max(4, Math.min(8, prefixLength))).toString('hex').slice(0, prefixLength);
    const secret = crypto.randomBytes(32).toString('base64url');
    return { prefix, secret, full: `${prefix}.${secret}` };
  }

  async createToken(tenantId: string, userId: string, scopes: string[], name?: string | null, expiresAt?: Date | null) {
    const { prefix, secret, full } = this.generateSecret();
    const entity = this.repo.create({
      tenantId,
      userId,
      name: name || null,
      tokenPrefix: prefix,
      tokenHash: sha256Hex(secret),
      scopes: JSON.stringify(scopes || []),
      expiresAt: expiresAt || null,
      isActive: true,
    });
    await this.repo.save(entity);
    return { token: full, prefix, scopes, expiresAt: entity.expiresAt };
  }

  async listUserTokens(userId: string, tenantId: string) {
    return this.repo.find({ where: { userId, tenantId } as any });
  }

  async updateToken(tokenId: string, tenantId: string, patch: Partial<{ isActive: boolean; scopes: string[]; expiresAt: Date | null; name: string | null; }> ) {
    const token = await this.repo.findOne({ where: { id: tokenId, tenantId } as any });
    if (!token) throw new NotFoundException('Token not found');
    if (patch.scopes) token.scopes = JSON.stringify(patch.scopes);
    if (patch.isActive != null) token.isActive = patch.isActive;
    if (patch.expiresAt !== undefined) token.expiresAt = patch.expiresAt;
    if (patch.name !== undefined) token.name = patch.name;
    await this.repo.save(token);
    return token;
  }

  async deleteToken(tokenId: string, tenantId: string) {
    const token = await this.repo.findOne({ where: { id: tokenId, tenantId } as any });
    if (!token) throw new NotFoundException('Token not found');
    await this.repo.delete(token.id);
    return { deleted: true };
  }
}
