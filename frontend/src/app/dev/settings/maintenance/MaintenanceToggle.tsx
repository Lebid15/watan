"use client";
import React, { useState, useEffect } from 'react';

interface StatusResp { enabled: boolean; message: string; updatedAt?: string|null }

async function fetchStatus(): Promise<StatusResp> {
  const r = await fetch('/api/dev/maintenance-status', { cache: 'no-store' });
  if (!r.ok) throw new Error('status failed');
  return r.json();
}

async function callToggle(enabled: boolean, message?: string) {
  const r = await fetch('/api/dev/toggle-nginx-maint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, message })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error('toggle failed: '+t.slice(0,400));
  }
}

async function saveMessage(message: string) {
  const r = await fetch('/api/dev/maintenance-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!r.ok) throw new Error('msg failed');
  return r.json();
}

export const MaintenanceToggle: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const s = await fetchStatus();
      setEnabled(s.enabled);
      setMessage(s.message || '');
    } catch (e:any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = async () => {
    setBusy(true); setError(null); setStatusMsg('');
    try {
      await callToggle(!enabled, message);
      setEnabled(!enabled);
      setStatusMsg(!enabled ? 'تم تفعيل وضع الصيانة (تذكر مسح كاش Cloudflare).' : 'تم إيقاف وضع الصيانة.');
    } catch (e:any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const saveOnlyMessage = async () => {
    setBusy(true); setError(null); setStatusMsg('');
    try {
      await saveMessage(message);
      setStatusMsg('تم حفظ الرسالة.');
    } catch (e:any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="p-4">تحميل...</div>;

  return (
    <div className="p-4 space-y-4 border rounded bg-white shadow-sm">
      <h2 className="text-lg font-semibold">وضع الصيانة</h2>
      <div className="text-sm text-gray-600">عند التفعيل سيظهر للمستخدمين صفحة الصيانة، ولا يعمل الموقع إلا مسارات المطور.</div>

      <div className="flex items-center gap-2">
        <button onClick={toggle} disabled={busy}
          className={`px-4 py-2 rounded text-white ${enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-50`}>
          {busy ? '...' : enabled ? 'إيقاف الصيانة' : 'تشغيل الصيانة'}
        </button>
        <span className={`text-sm font-medium ${enabled ? 'text-red-600' : 'text-green-600'}`}>
          {enabled ? 'مفعّل' : 'متوقف'}
        </span>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">رسالة الصيانة (تظهر للزوار):</label>
        <textarea className="w-full border rounded p-2 text-sm" rows={4}
          value={message} onChange={e=>setMessage(e.target.value)} />
        <div className="flex gap-2 mt-2">
          <button onClick={saveOnlyMessage} disabled={busy} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">حفظ الرسالة فقط</button>
          <button onClick={toggle} disabled={busy} className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm disabled:opacity-50">حفظ + تبديل الحالة</button>
        </div>
      </div>

      {statusMsg && <div className="text-sm text-green-700">{statusMsg}</div>}
      {error && <div className="text-sm text-red-600 whitespace-pre-wrap">خطأ: {error}</div>}
      <div className="text-xs text-gray-400">بعد التفعيل نفّذ Purge في Cloudflare لتحديث الجميع فوراً.</div>
    </div>
  );
};
