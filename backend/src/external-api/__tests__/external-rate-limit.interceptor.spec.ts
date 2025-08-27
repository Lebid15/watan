import { ExternalRateLimitInterceptor, __rateLimitBuckets } from '../external-rate-limit.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

function mockCtx(tokenId?: string): ExecutionContext {
  const req: any = { externalToken: tokenId ? { tokenId } : undefined };
  const resHeaders: Record<string,string> = {};
  const res: any = { setHeader: (k:string,v:string)=>{ resHeaders[k.toLowerCase()] = v; } };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as any;
}

describe('ExternalRateLimitInterceptor', () => {
  it('limits after 60 requests', () => {
    const ic = new ExternalRateLimitInterceptor();
    const ctx = mockCtx('t1');
    const handler: CallHandler = { handle: () => of({ ok: true }) };
    for (let i=0;i<60;i++) {
      expect(() => ic.intercept(ctx, handler)).not.toThrow();
    }
    // 61st
  expect(() => ic.intercept(ctx, handler)).toThrow(/RATE_LIMITED/);
  });

  it('resets after window', () => {
    const ic = new ExternalRateLimitInterceptor();
    const ctx = mockCtx('t2');
    const handler: CallHandler = { handle: () => of({ ok: true }) };
    for (let i=0;i<60;i++) ic.intercept(ctx, handler);
  // Force reset of bucket window
  const key = [...__rateLimitBuckets.keys()].find(k => k.includes('t2'))!;
  const bucket = __rateLimitBuckets.get(key)!;
  bucket.resetAt = Date.now() - 1; // expired
  expect(() => ic.intercept(ctx, handler)).not.toThrow(); // counts start fresh
  });
});
