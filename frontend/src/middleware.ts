import { NextRequest, NextResponse } from 'next/server';

// Apex (المنصة الرئيسية) يؤخذ من متغير البيئة أو يُستنتج لاحقاً
const CONFIGURED_APEX = (process.env.NEXT_PUBLIC_APEX_DOMAIN || '').toLowerCase().replace(/\/$/, '');

// Safe redirect helper with loop protection
function redirect(target: string, req: NextRequest) {
  const current = req.nextUrl;
  let url: URL | any;
  if (/^https?:\/\//i.test(target)) {
    url = new URL(target);
  } else {
  // Avoid redirect loop: if target equals current path -> just continue
  if (current.pathname === target) return NextResponse.next();
    url = current.clone();
    url.pathname = target;
    url.search = '';
  }
  // Loop protection: if destination (host+path) matches current, skip redirect
  try {
    const sameHost = (url.host || '') === current.host;
    const samePath = (url.pathname || '/') === current.pathname;
    if (sameHost && samePath) {
      return NextResponse.next();
    }
  } catch {}
  const res = NextResponse.redirect(url, 302);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

function parseHost(hostHeader: string | null) {
  if (!hostHeader) return { base: null as string | null, isSub: false, full: null as string | null, sub: null as string | null, apex: null as string | null };
  const full = hostHeader.toLowerCase().split(':')[0];
  const parts = full.split('.');
  if (parts[parts.length - 1] === 'localhost') {
    // localhost or sub.localhost
    if (parts.length === 1) return { base: 'localhost', isSub: false, full, sub: null, apex: 'localhost' };
    if (parts.length >= 2) {
      const sub = parts.slice(0, parts.length - 1).join('.');
      return { base: 'localhost', isSub: parts.length > 1, full, sub, apex: 'localhost' };
    }
  }
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub && !['www','app'].includes(sub)) {
      const apex = parts.slice(parts.length - 2).join('.');
      return { base: apex, isSub: true, full, sub, apex };
    }
  }
  // apex domain (root platform)
  const apex = parts.slice(-2).join('.');
  return { base: apex, isSub: false, full, sub: null, apex };
}

async function getMaintenanceState(): Promise<{ enabled: boolean; message: string } | null> {
  try {
    const res = await fetch(`/dev-maintenance`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as { enabled: boolean; message: string };
  } catch { return null; }
}

export async function middleware(req: NextRequest) {
  const { nextUrl, cookies, headers } = req;
  const path = nextUrl.pathname;

  // set tenant_host cookie once
  const hostInfo = parseHost(headers.get('host'));
  const existingTenant = cookies.get('tenant_host')?.value;
  const derived = hostInfo.isSub ? hostInfo.full : null;
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

  // Maintenance overlay (app-level). Exempt: /dev/*, /maintenance, /api/webhooks/*, /api/health
  const exemptMaint =
    path.startsWith('/dev/') ||
    path === '/maintenance' ||
    path.startsWith('/api/webhooks/') ||
    path === '/api/health';
  if (!exemptMaint && !path.startsWith('/api/')) {
    const bypassHeader = headers.get('x-maint-bypass')?.toLowerCase();
    const bypassCookie = cookies.get('X-MAINT-BYPASS')?.value?.toLowerCase();
    if (!(bypassHeader === 'allow' || bypassCookie === 'allow')) {
      const state = await getMaintenanceState();
      if (state?.enabled) {
        const url = nextUrl.clone();
        url.pathname = '/maintenance';
        return NextResponse.rewrite(url);
      }
    }
  }

  // only navigations
  const accept = headers.get('accept') || '';
  const isHtml = accept.includes('text/html');
  const mode = headers.get('sec-fetch-mode') || '';
  const dest = headers.get('sec-fetch-dest') || '';
  const isNavigate = mode === 'navigate' && (dest === 'document' || dest === 'empty');
  if (!isHtml || !isNavigate) return response ?? NextResponse.next();

  const token = cookies.get('access_token')?.value || cookies.get('auth')?.value || '';
  const rawRole = (cookies.get('role')?.value || '').toLowerCase();

  // Decode JWT payload (best-effort) to extract email for developer whitelist
  let email: string | null = null;
  if (token && typeof token === 'string' && token.includes('.')) {
    try {
      const parts = token.split('.');
      if (parts.length === 3 && parts[1] && typeof parts[1] === 'string') {
        const payloadPart = parts[1];
        if (!payloadPart || typeof payloadPart !== 'string') return NextResponse.next();
        const b64 = payloadPart.replace(/-/g,'+').replace(/_/g,'/');
        const json = JSON.parse(atob(b64));
        email = (json.email || json.user?.email || json.sub || '').toLowerCase();
      }
    } catch {}
  }
  // Normalize legacy role names: instance_owner → tenant_owner (hierarchy merge), owner → tenant_owner
  let role = rawRole;
  if (role === 'instance_owner' || role === 'owner' || role === 'admin') role = 'tenant_owner';

  // Enforce developer email whitelist: only listed emails keep developer privileges.
  // إذا لم تُحدد قائمة في env نستخدم القائمة الافتراضية (الحساب الوحيد للمطور).
  if (role === 'developer') {
    const envList = (process.env.DEVELOPER_EMAILS || process.env.NEXT_PUBLIC_DEVELOPER_EMAILS || '')
      .split(',')
      .map(s=>s.trim().toLowerCase())
      .filter(Boolean);
    const DEFAULT_DEV_EMAILS = ['alayatl.tr@gmail.com'];
    const whitelist = envList.length ? envList : DEFAULT_DEV_EMAILS;
    if (!email || !whitelist.includes(email)) {
      role = 'user'; // downgrade
    }
  }

  // مسارات عامة لا تتطلب تسجيل دخول (أضفنا /nginx-healthz لمسار فحص Nginx فقط)
  const publicPaths = new Set(['/login','/register','/password-reset','/verify-email','/nginx-healthz']);
  if (publicPaths.has(path)) {
    // حماية إضافية: إذا كنا على النطاق الرئيسي (apex) والمستخدم ليس مطوّراً مُخوّلاً امنع حتى صفحة /login من الاستمرار بعد تسجيل سابق
    if (hostInfo && !hostInfo.isSub && token) {
      if (role !== 'developer') {
        // إزالة الكوكيز وإعادة التوجيه لنفس الصفحة لإظهار نموذج نظيف (مع عدم استخدام التوكن)
        const res = response ?? NextResponse.next();
        res.cookies.set('access_token','',{path:'/',maxAge:0});
        res.cookies.set('role','',{path:'/',maxAge:0});
        return res;
      }
      if (role === 'developer') {
        // تحقق whitelist ثانيةً
        const envList = (process.env.DEVELOPER_EMAILS || process.env.NEXT_PUBLIC_DEVELOPER_EMAILS || '')
          .split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
        const wl = envList.length ? envList : ['alayatl.tr@gmail.com'];
        if (!email || !wl.includes(email)) {
          const res = response ?? NextResponse.next();
          res.cookies.set('access_token','',{path:'/',maxAge:0});
          res.cookies.set('role','',{path:'/',maxAge:0});
          return res;
        }
      }
    }
    return response ?? NextResponse.next();
  }

  if (!token) {
    if (path === '/') return response ?? NextResponse.next();
    return redirect('/login', req);
  }

  // Root path routing according to clarified matrix
  if (path === '/') {
    if (hostInfo.isSub) {
      if (role === 'tenant_owner') return redirect('/admin/dashboard', req);
      if (role === 'distributor') return redirect('/admin/distributor', req);
  if (role === 'user') return NextResponse.next();
      if (role === 'developer') {
        const apex = CONFIGURED_APEX || hostInfo.apex; // fallback
        const proto = req.nextUrl.protocol;
        // Prevent redirect loop if apex resolves to same subdomain
        if (apex && apex !== hostInfo.full) {
          return redirect(`${proto}//${apex}/dev`, req);
        }
        // If apex misconfigured (same host), fall back to staying put (developer should normally not hit subdomain root)
        return NextResponse.next();
      }
    } else { // apex platform
      if (role === 'developer') return redirect('/dev', req);
    }
  }

  if (path.startsWith('/admin')) {
    // Admin area valid only on subdomains
    if (!hostInfo.isSub) return redirect('/', req);
    const isDistributorSection = path.startsWith('/admin/distributor');
    if (role === 'tenant_owner') {
      // تأكيد أن /admin نفسها تعيد التوجيه إلى /admin/dashboard لتوقع UX
      if (path === '/admin') return redirect('/admin/dashboard', req);
      return response ?? NextResponse.next();
    }
    if (role === 'distributor') {
      if (isDistributorSection) return response ?? NextResponse.next();
      // distributor trying to access owner-only area
      return redirect('/admin/distributor', req);
    }
    if (role === 'developer') {
      const apex = CONFIGURED_APEX || hostInfo.apex;
      return redirect(`${req.nextUrl.protocol}//${apex}/dev`, req);
    }
    // user or unknown
  return redirect('/', req);
  }

  if (path.startsWith('/dev')) {
    // Only developer on apex domain
    if (hostInfo.isSub) {
      const apex = CONFIGURED_APEX || hostInfo.apex;
      if (apex && apex !== hostInfo.full) {
        return redirect(`${req.nextUrl.protocol}//${apex}/dev`, req);
      }
      // Apex misconfigured == current host: avoid loop, just block access for non-apex
      return redirect('/', req);
    }
    if (role !== 'developer') return redirect('/', req);
    return response ?? NextResponse.next();
  }

  if (path.startsWith('/app')) {
    // المسار القديم /app لم يعد مستخدماً: أعد التوجيه إلى الجذر لعدم وجود صفحة
    return redirect('/', req);
  }

  // تم إزالة صفحة /user/menu؛ أي طلب /menu يعاد للجذر
  if (path === '/menu') {
    return redirect('/', req);
  }

  return response ?? NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|assets|static|public).*)'],
};
