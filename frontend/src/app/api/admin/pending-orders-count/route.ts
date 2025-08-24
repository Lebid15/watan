import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  if (!token) return NextResponse.json({ count: 0 }, { status: 401 });

  try {
    const r = await fetch(`${API_BASE_URL}/admin/orders?status=pending&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) return NextResponse.json({ count: 0 }, { status: r.status });

    const data = await r.json();
    const items = Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
    return NextResponse.json({ count: items.length > 0 ? 1 : 0 });
  } catch {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
