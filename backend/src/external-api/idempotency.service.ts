import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { IdempotencyKey } from './idempotency-key.entity';

function hashReq(key: string) { return crypto.createHash('sha256').update(key).digest('hex'); }

@Injectable()
export class IdempotencyService {
  constructor(@InjectRepository(IdempotencyKey) private repo: Repository<IdempotencyKey>) {}

  async getOrCreate(tokenId: string, key: string, body: any): Promise<{ existed: boolean; record: IdempotencyKey; }> {
    const payload = JSON.stringify({ key, body });
    const requestHash = hashReq(payload);
    const existing = await this.repo.findOne({ where: { tokenId, key } as any });
    if (existing) return { existed: true, record: existing };
    const entity = this.repo.create({ tokenId, key, requestHash, ttlSeconds: 86400 });
    await this.repo.save(entity);
    return { existed: false, record: entity };
  }

  async attachOrder(id: string, orderId: string) {
    await this.repo.update(id, { orderId });
  }
}
