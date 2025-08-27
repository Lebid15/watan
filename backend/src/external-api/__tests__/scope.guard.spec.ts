import { ScopeGuard } from '../scope.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';

describe('ScopeGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as any as Reflector;
  const guard = new ScopeGuard(reflector);

  function ctx(required: string[], tokenScopes: string[] | undefined) {
    return {
      switchToHttp: () => ({ getRequest: () => ({ externalToken: tokenScopes ? { scopes: tokenScopes } : {} }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('allows when no required scopes', () => {
    expect(guard.canActivate(ctx([], ['a']))).toBe(true);
  });

  it('blocks when missing scope', () => {
  (reflector.getAllAndOverride as any).mockReturnValueOnce(['x']);
  expect(() => guard.canActivate(ctx(['x'], ['y']))).toThrow(ForbiddenException);
  });
});
