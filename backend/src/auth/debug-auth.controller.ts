import { Controller, Post, Req, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class DebugAuthController {
  constructor(private jwt: JwtService) {}

  @Post('debug-token')
  @ApiOperation({ summary: 'TEMP: Debug token & cookie presence (remove in production)' })
  debug(@Req() req: Request, @Body() body?: any) {
    const headerAuth = (req.headers as any)?.authorization || null;
    const bearer = headerAuth && headerAuth.startsWith('Bearer ')
      ? headerAuth.substring('Bearer '.length)
      : null;
    const cookieAuth = (req as any)?.cookies?.auth || null;
    const postedToken = body?.token || null;
    const tried: Record<string, any> = {};
    const attemptDecode = (label: string, token: string | null) => {
      if (!token) { tried[label] = null; return; }
      try {
        const decoded: any = this.jwt.decode(token, { json: true });
        tried[label] = decoded ? {
          sub: decoded.sub,
          role: decoded.role,
          tenantId: decoded.tenantId ?? null,
          exp: decoded.exp,
        } : 'un-decodable';
      } catch (e) {
        tried[label] = 'decode_error:' + (e as any)?.message;
      }
    };
    attemptDecode('bearerHeader', bearer);
    attemptDecode('cookieAuth', cookieAuth);
    attemptDecode('bodyToken', postedToken);
    return {
      now: new Date().toISOString(),
      hasCookie: !!cookieAuth,
      cookieLen: cookieAuth ? cookieAuth.length : 0,
      hasBearer: !!bearer,
      bearerLen: bearer ? bearer.length : 0,
      postedTokenLen: postedToken ? postedToken.length : 0,
      tried,
      headersSample: {
        host: (req.headers as any).host,
        origin: (req.headers as any).origin,
        cookie: ((req.headers as any).cookie || '').split(';').slice(0,2),
      },
    };
  }
}