// frontend/src/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Derive backend API base. On tenant subdomains we prefer relative '/api' so nginx proxies directly (avoids CORS and extra DNS hop).
function deriveApiBase(req: NextRequest): string {
  const host = req.headers.get('host') || '';
  if (/\.syrz1\.com$/i.test(host) && !/^api\./i.test(host)) {
    return '/api';
  }
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase && /^https?:\/\//i.test(envBase)) return envBase.replace(/\/$/, '');
  if (/\.syrz1\.com$/i.test(host)) {
    const root = host.split('.').slice(-2).join('.');
    return `https://api.${root}/api`;
  }
  return 'http://localhost:3000/api'; // backend dev port
}

export async function GET(req: NextRequest) {
  const API_BASE_URL = deriveApiBase(req);
  try {
  // Accept either access_token (client) or auth (httpOnly from backend) cookie.
  const token = req.cookies.get('access_token')?.value || req.cookies.get('auth')?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    // نمرّر التوكن للباك إند عبر Authorization
  const originalHost = req.headers.get('host') || '';
  const profileUrl = API_BASE_URL === '/api' ? '/api/users/profile' : `${API_BASE_URL}/users/profile`;
  const r = await fetch(profileUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Tenant-Host': originalHost,
      },
      // مهم: الباك إند على بورت آخر، فلا ترسل كوكي المتصفح له (يكفي Authorization)
      // credentials: 'omit' (الافتراضي)
    });

    if (!r.ok) {
      if (r.status === 401) {
        return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
      }
      return NextResponse.json({ ok: false, error: 'UPSTREAM_ERROR', status: r.status }, { status: 500 });
    }

    const data = await r.json();
  return NextResponse.json({ ok: true, user: data });
  } catch (e) {
  return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }
}
