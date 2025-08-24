import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { token, role, maxAgeDays = 7 } = await req.json();

    if (!token || !role) {
      return NextResponse.json({ ok: false, error: 'token and role required' }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });

    // كوكيز التوكن
    res.cookies.set('access_token', token, {
      httpOnly: true, // لا تقرأ من الجافاسكربت
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeDays * 24 * 60 * 60,
    });

    // كوكيز الدور
    res.cookies.set('role', role, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeDays * 24 * 60 * 60,
    });

    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'bad payload' }, { status: 400 });
    }
}
