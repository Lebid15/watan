import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { format3 } from '../money/money.util';
import { isFeatureEnabled } from '../feature-flags';

@Injectable()
export class TenantMoneyDisplayInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: any = context.switchToHttp().getRequest();
    const role: string = req?.user?.roleFinal || req?.user?.role;
    const preferredCode: string | undefined = req?.user?.preferredCurrencyCode;
    const isTenantApi = /^\/(api\/)?tenant\//.test(req.path || '');
    if (!isTenantApi || !isFeatureEnabled('catalogLinking')) return next.handle();
    return next.handle().pipe(map((data) => this.decorate(data, role, preferredCode)));
  }

  private decorate(payload: any, role: string, preferredCode?: string) {
    if (!payload || typeof payload !== 'object') return payload;
    const mutateAmounts = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      const usdFields = ['priceUSD','capitalUSD','sellUSD','profitUSD','unitPriceUSD'];
      for (const f of usdFields) {
        if (Object.prototype.hasOwnProperty.call(obj,f) && typeof obj[f] === 'number') {
          obj[`${f}3`] = format3(obj[f]);
        }
      }
    };
    if (Array.isArray(payload)) payload.forEach(mutateAmounts);
    else if (Array.isArray(payload.items)) payload.items.forEach(mutateAmounts);
    else mutateAmounts(payload);
    return payload;
  }
}
