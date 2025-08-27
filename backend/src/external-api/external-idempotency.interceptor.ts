import { CallHandler, ExecutionContext, Injectable, NestInterceptor, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { IdempotencyKey } from './idempotency-key.entity';
import { ProductOrder } from '../products/product-order.entity';

// Stable stringify with sorted object keys (non-recursive arrays keep order) to ensure
// deterministic hashing regardless of input key order.
function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => stableStringify(v)).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k)+':' + stableStringify((value as any)[k])).join(',') + '}';
}

function hashPayload(method: string, path: string, body: any) {
  const norm = stableStringify(body || {});
  return crypto.createHash('sha256').update(method + '|' + path + '|' + norm).digest('hex');
}

@Injectable()
export class ExternalIdempotencyInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(IdempotencyKey) private repo: Repository<IdempotencyKey>,
    @InjectRepository(ProductOrder) private ordersRepo: Repository<ProductOrder>,
  ) {}

  async handlePre(req: any, res: any) {
    const token = req.externalToken;
    if (!token) return null;
    if (req.method !== 'POST' || !/\/api\/tenant\/external\/v1\/orders$/.test(req.path)) return null;
    const keyHeader = req.headers['idempotency-key'];
  if (!keyHeader) throw new UnprocessableEntityException({ code: 'IDEMPOTENCY_REQUIRED', message: 'IDEMPOTENCY_REQUIRED' });
    const key = String(keyHeader).slice(0, 80);
    const requestHash = hashPayload(req.method, req.path, req.body);
    let record = await this.repo.findOne({ where: { tokenId: token.tokenId, key } as any });
    if (record) {
      if (record.requestHash !== requestHash) {
  throw new ConflictException({ code: 'IDEMPOTENCY_MISMATCH', message: 'IDEMPOTENCY_MISMATCH' });
      }
      if (record.orderId) {
        const existing = await this.ordersRepo.findOne({ where: { id: record.orderId } as any });
        if (existing) {
          res.setHeader('X-Idempotency-Cache', 'HIT');
          // Force 200 OK instead of default POST 201 for cached replay
          if (typeof res.status === 'function') {
            res.status(200);
          } else {
            res.statusCode = 200;
          }
          return { shortCircuit: true, payload: { orderId: existing.id, status: existing.status, createdAt: existing.createdAt } };
        }
      }
      // existing without order id -> still in progress
  throw new ConflictException({ code: 'IDEMPOTENCY_IN_PROGRESS', message: 'IDEMPOTENCY_IN_PROGRESS' });
    }
    record = this.repo.create({ tokenId: token.tokenId, key, requestHash, ttlSeconds: 86400 });
    await this.repo.save(record);
    (req as any).__idempotencyRecordId = record.id;
    return null;
  }

  async attachOrder(recordId: string | undefined, orderId: string) {
    if (!recordId) return;
    await this.repo.update(recordId, { orderId });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req: any = http.getRequest();
    const res: any = http.getResponse();
    return of(null).pipe(
      mergeMap(() => this.handlePre(req, res)),
      mergeMap((pre) => {
        if (pre?.shortCircuit) return of(pre.payload);
        return next.handle().pipe(
          map(async (payload: any) => {
            if (req.method === 'POST' && /\/api\/tenant\/external\/v1\/orders$/.test(req.path) && payload?.orderId) {
              await this.attachOrder((req as any).__idempotencyRecordId, payload.orderId);
            }
            return payload;
          }),
          mergeMap(p => p instanceof Promise ? p : of(p)),
        );
      }),
    );
  }
}
