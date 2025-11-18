import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    '/',
    '/(ar|en|tr)/:path*',
    '/((?!_next|_vercel|.*\\..*).*)'
  ]
};
