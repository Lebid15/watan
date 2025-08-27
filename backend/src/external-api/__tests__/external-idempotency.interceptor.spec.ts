import { ExternalIdempotencyInterceptor } from '../external-idempotency.interceptor';
import { IdempotencyKey } from '../idempotency-key.entity';
import { ProductOrder } from '../../products/product-order.entity';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { Repository } from 'typeorm';

function makeCtx(method: string, path: string, body: any, tokenId?: string) {
  const req: any = { method, path, body, headers: {}, externalToken: tokenId ? { tokenId } : undefined };
  const res: any = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as any as ExecutionContext;
}

class MemRepo<T extends { id?: string }> {
  rows: T[] = [];
  constructor(private prefix: string) {}
  create(obj: any) { return obj as T; }
  async save(obj: any) { if (!obj.id) obj.id = this.prefix + (this.rows.length+1); this.rows.push(obj); return obj; }
  async findOne(opts: any) { const where = opts.where || {}; return this.rows.find(r => Object.entries(where).every(([k,v]) => (r as any)[k] === v)) || null; }
  async update(id: string, patch: any) { const r = this.rows.find(r => r.id === id); if (r) Object.assign(r, patch); }
}

describe('ExternalIdempotencyInterceptor', () => {
  let interceptor: ExternalIdempotencyInterceptor;
  let keysRepo: MemRepo<IdempotencyKey>;
  let ordersRepo: MemRepo<ProductOrder & { id: string; status: string; createdAt: Date }>;

  beforeAll(() => {
    keysRepo = new MemRepo<IdempotencyKey>('k');
    ordersRepo = new MemRepo<any>('o');
    // @ts-ignore manual inject
    interceptor = new ExternalIdempotencyInterceptor(keysRepo as any as Repository<IdempotencyKey>, ordersRepo as any as Repository<ProductOrder>);
  });

  it('requires Idempotency-Key', async () => {
    const ctx = makeCtx('POST','/api/tenant/external/v1/orders',{ linkCode:'x', quantity:1 },'tok1');
    const handler: CallHandler = { handle: () => of({}) };
  await expect(interceptor.intercept(ctx, handler).toPromise()).rejects.toThrow(/IDEMPOTENCY_REQUIRED/i);
  });

  it('handles mismatch', async () => {
    // First create with key
    const ctx1 = makeCtx('POST','/api/tenant/external/v1/orders',{ linkCode:'x', quantity:1 },'tok2');
    (ctx1.switchToHttp().getRequest() as any).headers['idempotency-key'] = 'K1';
  await interceptor.intercept(ctx1, { handle: () => of({ orderId: 'O1' }) }).toPromise();
    // Repeat with different body
    const ctx2 = makeCtx('POST','/api/tenant/external/v1/orders',{ linkCode:'x', quantity:2 },'tok2');
    (ctx2.switchToHttp().getRequest() as any).headers['idempotency-key'] = 'K1';
  await expect(interceptor.intercept(ctx2, { handle: () => of({ orderId: 'O2' }) }).toPromise()).rejects.toThrow(/IDEMPOTENCY_MISMATCH/);
  });

  it('IN_PROGRESS when record exists without orderId', async () => {
    const reqCtx = makeCtx('POST','/api/tenant/external/v1/orders',{ linkCode:'y', quantity:1 },'tok3');
    const req: any = reqCtx.switchToHttp().getRequest();
    req.headers['idempotency-key'] = 'K2';
    // First call: interceptor will create record then underlying handler throws (simulate in-progress)
  await expect(interceptor.intercept(reqCtx, { handle: () => { throw new Error('simulate processing'); } }).toPromise()).rejects.toThrow();
    // Second call with same key and body should produce IN_PROGRESS conflict
    const ctx2 = makeCtx('POST','/api/tenant/external/v1/orders',{ linkCode:'y', quantity:1 },'tok3');
    (ctx2.switchToHttp().getRequest() as any).headers['idempotency-key'] = 'K2';
    await expect(interceptor.intercept(ctx2, { handle: () => of({}) }).toPromise()).rejects.toThrow(/IDEMPOTENCY_IN_PROGRESS/);
  });

  it('HIT returns cached response', async () => {
    const ctx1 = makeCtx('POST','/api/tenant/external/v1/orders',{ linkCode:'z', quantity:1 },'tok4');
    (ctx1.switchToHttp().getRequest() as any).headers['idempotency-key'] = 'K3';
  await interceptor.intercept(ctx1, { handle: () => of({ orderId: 'ORDZ' }) }).toPromise();
  // Force mark orderId on stored record (simulate commit)
  const rec = keysRepo.rows.find(r => (r as any).tokenId === 'tok4');
  if (rec) (rec as any).orderId = 'ORDZ';
  await ordersRepo.save({ id: 'ORDZ', status: 'pending', createdAt: new Date() } as any);
    const ctx2 = makeCtx('POST','/api/tenant/external/v1/orders',{ linkCode:'z', quantity:1 },'tok4');
    (ctx2.switchToHttp().getRequest() as any).headers['idempotency-key'] = 'K3';
    const obs = interceptor.intercept(ctx2, { handle: () => of({ orderId: 'OTHER' }) });
    const res = await obs.toPromise();
    expect(res.orderId).toBe('ORDZ');
  });
});
