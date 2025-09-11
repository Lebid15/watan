"use client";
import { useEffect, useState } from 'react';

async function getState() {
  try {
    const r = await fetch('/api/dev/maintenance-status', { cache: 'no-store' });
    if (!r.ok) throw 0;
    return r.json();
  } catch { return { enabled: false }; }
}

async function setState(enabled: boolean, message: string) {
  const r = await fetch('/api/dev/toggle-nginx-maint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, message }),
  });
  if (!r.ok) throw new Error('failed');
  return r.json();
}

export default function DevMaintenanceSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await getState();
        setEnabled(Boolean(s.enabled));
        if (s.message) setMessage(String(s.message));
      } catch {}
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    setOk('');
    try {
  await setState(enabled, message);
  const fresh = await getState();
  setEnabled(Boolean(fresh.enabled));
  if (fresh.message) setMessage(String(fresh.message));
  setOk('تم الحفظ');
    } catch {
      setError('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">وضع الصيانة</h1>
      <p className="text-text-secondary mb-4 text-sm">هذا التبديل يفرض صفحة صيانة على مستوى تطبيق الفرونت فقط. مستوى Nginx ما زال مدعوماً من السيرفر.</p>

      {loading ? (
        <div>جارٍ التحميل…</div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(e)=>setEnabled(e.target.checked)} />
            <span>تفعيل وضع الصيانة (Nginx عالمي)</span>
          </label>

          <div>
            <div className="mb-2 text-sm text-text-secondary">رسالة الصيانة</div>
            <textarea
              className="w-full min-h-[180px] p-3 border border-border rounded bg-bg-input text-[var(--color-text-primary)] focus:outline-none"
              value={message}
              onChange={(e)=>setMessage(e.target.value)}
              maxLength={5000}
            />
          </div>

          <div className="flex gap-2 items-center">
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-primary text-primary-contrast disabled:opacity-50">
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
            {ok && <span className="text-success text-sm">{ok}</span>}
            {error && <span className="text-danger text-sm">{error}</span>}
          </div>

          <div className="text-xs text-text-secondary">
            لتجاوز الصيانة أثناء الاختبار: أرسل الهيدر X-Maint-Bypass: allow أو الكوكي X-MAINT-BYPASS=allow
          </div>
        </div>
      )}
    </div>
  );
}
