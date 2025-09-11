import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

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
    let body: any = null;
    try { body = await req.json(); } catch {
      try {
        const text = await req.text();
        if (text) {
          try { body = JSON.parse(text); } catch {
            const params = new URLSearchParams(text);
            body = Object.fromEntries(params.entries());
          }
        }
      } catch {}
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
    }
    const onVals = ['1','true','on','yes'];
    const enabled = typeof body.enabled === 'string' ? onVals.includes(body.enabled.toLowerCase()) : Boolean(body.enabled);
    const msgRaw = body.message ?? STATE.message;
    const message = typeof msgRaw === 'string' && msgRaw.trim().length > 0 ? String(msgRaw).slice(0, 5000) : STATE.message;
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
