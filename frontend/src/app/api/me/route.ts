// frontend/src/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Always use central NEXT_PUBLIC_API_URL (no relative fallback) to avoid hitting tenant host.
function deriveApiBase(_req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase && /^https?:\/\//i.test(envBase)) return envBase.replace(/\/$/, '');
  return 'http://localhost:3000/api';
}

export async function GET(req: NextRequest) {
  const API_BASE_URL = deriveApiBase(req);
  try {
    console.log('[api/me] start', { host: req.headers.get('host'), apiBase: API_BASE_URL });
  // Accept either access_token (client) or auth (httpOnly from backend) cookie.
  const token = req.cookies.get('access_token')?.value || req.cookies.get('auth')?.value;
    if (!token) {
      console.warn('[api/me] no token cookie');
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    // نمرّر التوكن للباك إند عبر Authorization
  const originalHost = req.headers.get('host') || '';
  const profileUrl = `${API_BASE_URL}/users/profile`;
  console.log('[api/me] fetching profile', { profileUrl, hasToken: !!token });
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
        console.warn('[api/me] upstream 401');
        return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
      }
      console.error('[api/me] upstream error', r.status);
      return NextResponse.json({ ok: false, error: 'UPSTREAM_ERROR', status: r.status }, { status: 500 });
    }

    const data = await r.json();
  console.log('[api/me] success');
  return NextResponse.json({ ok: true, user: data });
  } catch (e) {
  console.error('[api/me] exception', (e as any)?.message);
  return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }
}
