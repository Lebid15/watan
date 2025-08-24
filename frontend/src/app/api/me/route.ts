// frontend/src/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    // نمرّر التوكن للباك إند عبر Authorization
    const r = await fetch(`${API_BASE_URL}/users/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
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
