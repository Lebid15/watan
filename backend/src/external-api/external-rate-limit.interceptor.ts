import { CallHandler, ExecutionContext, Injectable, NestInterceptor, HttpException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface Bucket { count: number; resetAt: number; }
const WINDOW_MS = 60_000; // 60s
const LIMIT = 60;

// In-memory fallback. (Optional: plug redis via env REDIS_URL later)
// Exported ONLY for unit tests (not part of public API)
export const __rateLimitBuckets = new Map<string, Bucket>();

function touch(key: string) {
  const now = Date.now();
  let b = __rateLimitBuckets.get(key);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    __rateLimitBuckets.set(key, b);
  }
  b.count += 1;
  return b;
}

@Injectable()
export class ExternalRateLimitInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: any = context.switchToHttp().getRequest();
    const res: any = context.switchToHttp().getResponse();
    const token = req.externalToken;
    if (token) {
      const key = `ext:${token.tokenId}`;
      const b = touch(key);
      const remaining = Math.max(0, LIMIT - b.count);
      res.setHeader('X-RateLimit-Limit', LIMIT.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.floor(b.resetAt / 1000).toString());
      if (b.count > LIMIT) {
  throw new HttpException({ code: 'RATE_LIMITED', message: 'RATE_LIMITED' }, 429);
      }
    }
    return next.handle().pipe(tap(() => {}));
  }
}
