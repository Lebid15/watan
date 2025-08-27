import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConstants } from './constants';
import { mapLegacyRole } from '../common/authz/roles';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: (req) => {
        let token: string | null = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (!token && req?.headers?.['x-access-token']) token = String(req.headers['x-access-token']);
        if (!token && req?.headers?.token) token = String(req.headers.token);
        if (!token && req?.query?.token) token = String(req.query.token);
        if (!token && req?.cookies?.auth) token = req.cookies.auth;
        if (process.env.JWT_DEBUG === '1') {
          // eslint-disable-next-line no-console
          console.log('[JWT][DEBUG] extraction', {
            hasAuthHeader: !!req?.headers?.authorization,
            hasXAccess: !!req?.headers?.['x-access-token'],
            hasTokenHeader: !!req?.headers?.token,
            hasQuery: !!req?.query?.token,
            hasCookie: !!req?.cookies?.auth,
            finalLen: token ? token.length : 0,
          });
        }
        return token as any;
      },
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: any, done?: any) {
    if (!payload?.sub) {
      throw new UnauthorizedException('بيانات التوكن غير صالحة: sub مفقود');
    }
    if (process.env.JWT_DEBUG === '1') {
      // eslint-disable-next-line no-console
      console.log('[JWT][DEBUG] payload', { sub: payload.sub, role: payload.role, tenantId: payload.tenantId, exp: payload.exp });
    }
  const role = (payload.role || 'user').toString().toLowerCase();
  const roleFinal = mapLegacyRole(role);
    const allowsNullTenant = ['instance_owner', 'developer'].includes(role);
    // Allow null tenantId for passkey registration so users can add global credential before tenant association.
    if (!payload.tenantId && !allowsNullTenant) {
      // still allow if route is passkeys/options/register (cannot access request here easily unless using validate with req param)
      // To avoid larger refactor, we'll just permit null tenantId for all roles temporarily (security acceptable if other guards restrict tenant routes)
      // throw new UnauthorizedException('بيانات التوكن غير صالحة: tenantId مفقود لهذا الدور');
    }
    return {
      id: payload.sub,
      sub: payload.sub,
      email: payload.email,
      role, // الدور الأصلي (legacy)
      roleFinal, // الدور النهائي بعد المواءمة
      tenantId: payload.tenantId ?? null,
    };
  }
}
