import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPES_KEY } from './scopes.decorator';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req: any = ctx.switchToHttp().getRequest();
    const required: string[] = this.reflector.getAllAndOverride(SCOPES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]) || [];
    if (!required.length) return true;
    const token = req.externalToken;
    if (!token) throw new ForbiddenException('Missing external token context');
    const scopes: string[] = token.scopes || [];
  const missing = required.filter(r => !scopes.includes(r));
  if (missing.length) throw new ForbiddenException({ code: 'MISSING_SCOPE', message: 'MISSING_SCOPE' });
    return true;
  }
}
