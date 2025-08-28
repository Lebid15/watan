// frontend/src/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Use api.<root>/api always in production to avoid hitting same subdomain frontend which 404s for /api/users/profile
function deriveApiBase(req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase && /^https?:\/\//i.test(envBase)) return envBase.replace(/\/$/, '');
  const host = req.headers.get('host') || '';
  if (/\.syrz1\.com$/i.test(host)) {
    const root = host.split('.').slice(-2).join('.');
    return `https://api.${root}/api`;
  }
  return 'http://localhost:3000/api'; // backend dev port
}

export async function GET(req: NextRequest) {
  const API_BASE_URL = deriveApiBase(req);
  try {
    const token = req.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    // نمرّر التوكن للباك إند عبر Authorization
    const originalHost = req.headers.get('host') || '';
    const r = await fetch(`${API_BASE_URL}/users/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Tenant-Host': originalHost,
      },
      // مهم: الباك إند على بورت آخر، فلا ترسل كوكي المتصفح له (يكفي Authorization)
      // credentials: 'omit' (الافتراضي)
    });

    if (!r.ok) {
      // لو 401 من الباك: نعتبرها جلسة غير صالحة
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const data = await r.json();
    return NextResponse.json({ ok: true, user: data });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
