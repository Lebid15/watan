import { NextRequest, NextResponse } from 'next/server';

// In-memory state (ephemeral per instance)
let STATE: { enabled: boolean; message: string; updatedAt: string } = {
  enabled: false,
  message: 'يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.',
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  return NextResponse.json({ enabled: STATE.enabled, message: STATE.message, updatedAt: STATE.updatedAt });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const enabled = Boolean(body?.enabled);
    const message = typeof body?.message === 'string' && body.message.trim().length > 0
      ? String(body.message).slice(0, 5000)
      : STATE.message;
    STATE = { enabled, message, updatedAt: new Date().toISOString() };
    return NextResponse.json(STATE);
  } catch {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
