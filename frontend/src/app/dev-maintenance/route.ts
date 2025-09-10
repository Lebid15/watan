import { NextRequest, NextResponse } from 'next/server';

let STATE: { enabled: boolean; message: string; updatedAt: string } = {
  enabled: false,
  message: 'يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.',
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  const res = NextResponse.json({ enabled: STATE.enabled, message: STATE.message, updatedAt: STATE.updatedAt });
  // Mirror cookie on GET for idempotence
  const domain = process.env.NEXT_PUBLIC_APEX_DOMAIN || 'wtn4.com';
  if (STATE.enabled) {
    res.cookies.set('MAINT_ON', '1', { path: '/', sameSite: 'lax', httpOnly: false, domain: `.${domain}` });
  } else {
    res.cookies.set('MAINT_ON', '', { path: '/', maxAge: 0, domain: `.${domain}` });
  }
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const enabled = Boolean(body?.enabled);
    const message = typeof body?.message === 'string' && body.message.trim().length > 0
      ? String(body.message).slice(0, 5000)
      : STATE.message;
    STATE = { enabled, message, updatedAt: new Date().toISOString() };
    const res = NextResponse.json(STATE);
    const domain = process.env.NEXT_PUBLIC_APEX_DOMAIN || 'wtn4.com';
    if (enabled) {
      res.cookies.set('MAINT_ON', '1', { path: '/', sameSite: 'lax', httpOnly: false, domain: `.${domain}` });
    } else {
      res.cookies.set('MAINT_ON', '', { path: '/', maxAge: 0, domain: `.${domain}` });
    }
    return res;
  } catch {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
