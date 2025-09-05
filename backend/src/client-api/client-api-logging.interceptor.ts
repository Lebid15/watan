import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientApiRequestLog } from './client-api-request-log.entity';
import { extractNormalizedIp } from './client-api-ip.util';
import { Observable, catchError, finalize, map, of, throwError } from 'rxjs';

@Injectable()
export class ClientApiLoggingInterceptor implements NestInterceptor {
  constructor(@InjectRepository(ClientApiRequestLog) private logsRepo: Repository<ClientApiRequestLog>) {}

  async prune(userId: string) {
    // keep last 20 only
    const ids = await this.logsRepo.find({ where: { userId } as any, order: { createdAt: 'DESC' }, take: 50 });
    const extra = ids.slice(20);
    if (extra.length) await this.logsRepo.delete(extra.map(e => e.id));
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
          this.logsRepo.insert({ userId: user.id, tenantId, method, path, ip, code: 0 })
            .then(() => this.prune(user.id)).catch(()=>{});
        }
        return val;
      }),
      catchError((err) => {
        const code = typeof err?.codeNumber === 'number' ? err.codeNumber : (err?.response?.codeNumber || err?.response?.code || 500);
        if (user) {
          this.logsRepo.insert({ userId: user.id, tenantId, method, path, ip, code }).then(()=> this.prune(user.id)).catch(()=>{});
        }
        return throwError(() => err);
      }),
      // finalize not needed for now, mapping done above
    );
  }
}
