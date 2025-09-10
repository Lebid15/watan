export const dynamic = 'force-dynamic';

async function fetchState() {
  try {
  const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/dev-maintenance`, { cache: 'no-store' });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export default async function MaintenancePage() {
  const state = await fetchState();
  const msg = state?.message || 'يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.';
  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-xl w-full rounded-lg border border-border bg-bg-surface p-6 shadow">
        <h1 className="text-xl font-bold mb-2">الموقع في وضع الصيانة</h1>
        <p className="text-text-secondary whitespace-pre-wrap break-words">{msg}</p>
        <div className="text-xs text-text-secondary mt-3">رمز الحالة: 503 (تنبيهي)</div>
      </div>
    </div>
  );
}
