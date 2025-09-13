import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientApiRequestLog } from './client-api-request-log.entity';
import { extractNormalizedIp } from './client-api-ip.util';
import { Observable, catchError, map, throwError } from 'rxjs';

// In tests we want to avoid fire-and-forget async writes that may race with DataSource teardown (causing SQLITE_MISUSE).
// Setting TEST_SYNC_CLIENT_API_LOGS=1 will make inserts awaited inline.
const TEST_SYNC = process.env.TEST_SYNC_CLIENT_API_LOGS === '1';

// Track pending log insert promises so tests can optionally await a flush if needed.
const pending: Promise<any>[] = [];
export async function flushClientApiLogs() {
  if (!pending.length) return; // nothing to wait for
  try {
    await Promise.allSettled([...pending]);
  } catch { /* ignore */ }
  pending.length = 0;
}

@Injectable()
export class ClientApiLoggingInterceptor implements NestInterceptor {
  constructor(@InjectRepository(ClientApiRequestLog) private logsRepo: Repository<ClientApiRequestLog>) {}

  async prune(userId: string) {
    // Keep newest 20 only (deterministic single DELETE based on createdAt ordering)
    // Works on both Postgres & SQLite without raw queries (reduces noisy teardown logs)
    try {
      const old = await this.logsRepo.find({
        where: { userId } as any,
        order: { createdAt: 'DESC' as any },
        skip: 20,
        take: 500, // safety upper bound
        select: ['id'] as any,
      });
      if (old.length) await this.logsRepo.delete(old.map(o=>o.id));
    } catch { /* ignore prune failures */ }
  }

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req: any = ctx.switchToHttp().getRequest();
    const user = req.clientApiUser;
    const tenantId = req.tenant?.id;
  const ip = extractNormalizedIp(req.headers['x-forwarded-for'] as any, req.socket?.remoteAddress);
    const path = req.originalUrl || req.url || '';
    const method = req.method || 'GET';
    const started = Date.now();

    // Only log /client/api/* paths
    if (!path.startsWith('/client/api/')) {
      return next.handle();
    }
    return next.handle().pipe(
      map((val) => {
        if (user) {
          if (TEST_SYNC) {
            // Await synchronously inside map (safe: small single-row insert)
            return Promise.resolve(this.logsRepo.insert({ userId: user.id, tenantId, method, path, ip, code: 0 })
              .then(() => this.prune(user.id))
              .catch(()=>{})).then(()=> val);
          } else {
            const p = this.logsRepo.insert({ userId: user.id, tenantId, method, path, ip, code: 0 })
              .then(() => this.prune(user.id)).catch(()=>{});
            pending.push(p);
          }
        }
        return val;
      }),
      catchError((err) => {
        const code = typeof err?.codeNumber === 'number' ? err.codeNumber : (err?.response?.codeNumber || err?.response?.code || 500);
        if (user) {
          if (TEST_SYNC) {
            return Promise.resolve(this.logsRepo.insert({ userId: user.id, tenantId, method, path, ip, code })
              .then(() => this.prune(user.id))
              .catch(()=>{})).then(() => { throw err; });
          } else {
            const p = this.logsRepo.insert({ userId: user.id, tenantId, method, path, ip, code })
              .then(()=> this.prune(user.id)).catch(()=>{});
            pending.push(p);
          }
        }
        return throwError(() => err);
      }),
    );
  }
}
