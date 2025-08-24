import { NextRequest, NextResponse } from 'next/server';

function redirect(path: string, req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = '';
  const res = NextResponse.redirect(url, 302);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

function extractTenantHost(host: string | null): string | null {
  if (!host) return null;
  const base = host.toLowerCase().split(':')[0];
  const parts = base.split('.');
  if (parts.length < 2) return null;
  if (parts[parts.length - 1] === 'localhost') {
    if (parts.length === 2) {
      const sub = parts[0];
      if (sub && sub !== 'www' && sub !== 'localhost') return `${sub}.localhost`;
    }
    return null;
  }
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub && !['www','app'].includes(sub)) return base;
  }
  return null;
}

export function middleware(req: NextRequest) {
  const { nextUrl, cookies, headers } = req;
  const path = nextUrl.pathname;

  // set tenant_host cookie once
  const existingTenant = cookies.get('tenant_host')?.value;
  const derived = extractTenantHost(headers.get('host'));
  let response: NextResponse | null = null;
  if (!existingTenant && derived) {
    response = NextResponse.next();
    response.cookies.set('tenant_host', derived, { path: '/', httpOnly: false, sameSite: 'lax' });
    response.headers.set('X-Tenant-Host', derived);
  }

  // skip assets
  const isAsset =
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path === '/favicon.ico' ||
    path.startsWith('/assets') ||
    path.startsWith('/static') ||
    path.startsWith('/public') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|map|txt|xml|woff2?|ttf|otf)$/.test(path);
  if (isAsset) return response ?? NextResponse.next();

  // only navigations
  const accept = headers.get('accept') || '';
  const isHtml = accept.includes('text/html');
  const mode = headers.get('sec-fetch-mode') || '';
  const dest = headers.get('sec-fetch-dest') || '';
  const isNavigate = mode === 'navigate' && (dest === 'document' || dest === 'empty');
  if (!isHtml || !isNavigate) return response ?? NextResponse.next();

  const token = cookies.get('access_token')?.value || '';
  const role = (cookies.get('role')?.value || '').toLowerCase();

  // مسارات عامة لا تتطلب تسجيل دخول (أضفنا /nginx-healthz لمسار فحص Nginx فقط)
  const publicPaths = new Set(['/login','/register','/password-reset','/verify-email','/nginx-healthz']);
  if (publicPaths.has(path)) return response ?? NextResponse.next();

  if (!token) {
    if (path === '/') return response ?? NextResponse.next();
    return redirect('/login', req);
  }

  if (path.startsWith('/admin')) {
    const allowed = new Set(['admin','supervisor','owner','instance_owner']);
    if (!allowed.has(role)) {
      if (role === 'developer') return redirect('/dev', req);
      return redirect('/', req);
    }
    return response ?? NextResponse.next();
  }

  if (path.startsWith('/dev')) {
    const ok = role === 'developer' || role === 'instance_owner';
    if (!ok) {
      if (['admin','supervisor','owner'].includes(role)) return redirect('/admin/dashboard', req);
      return redirect('/', req);
    }
    return response ?? NextResponse.next();
  }

  return response ?? NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|assets|static|public).*)'],
};