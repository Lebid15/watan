"use client";
import { useEffect, useState } from 'react';
import { fmtDateStable } from '@/lib/fmtDateStable';
import api from '@/utils/api';

interface NoteResp { value: string; updatedAt: string | null }

export default function DevAdminNotePage() {
  const [current, setCurrent] = useState('');
  const [latest, setLatest] = useState<NoteResp>({ value: '', updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function fetchLatest() {
    try {
      const r = await api.get<NoteResp>('/dev/notes/latest');
      setLatest(r.data);
      if (!current) setCurrent(r.data.value || '');
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    (async () => {
      await fetchLatest();
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const r = await api.post<NoteResp>('/dev/notes', { value: current });
  setSavedAt(fmtDateStable(new Date()));
      setLatest(r.data);
    } catch {
      setError('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">ملاحظة عامة (Global Developer Note)</h1>
      <p className="text-text-secondary text-sm mb-4">هذه الملاحظة تظهر لكل المتاجر (التينانت) إن كانت غير فارغة.</p>
      {error && <div className="mb-3 text-danger text-sm">{error}</div>}
      {loading ? (
        <div>جارٍ التحميل…</div>
      ) : (
        <>
          <textarea
            className="w-full min-h-[40vh] p-3 border border-border rounded bg-bg-input text-[var(--color-text-primary)] focus:outline-none"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            maxLength={5000}
            placeholder="اكتب ملاحظة عامة تظهر للمستأجرين..."
          />
          <div className="flex items-center justify-between mt-2 text-xs text-text-secondary">
            <span>{current.length}/5000</span>
            {savedAt && <span>آخر حفظ محلي: {savedAt}</span>}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded bg-primary text-primary-contrast disabled:opacity-50"
            >{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button>
            <button
              onClick={() => setCurrent(latest.value || '')}
              disabled={saving}
              className="px-4 py-2 rounded bg-bg-surface-alt border border-border"
            >استرجاع آخر محفوظ</button>
          </div>
          <div className="mt-6 text-sm">
            <div className="font-semibold mb-1">آخر ملاحظة محفوظة (من الخادم):</div>
            {latest.value ? (
              <div className="rounded border border-border bg-bg-surface p-3 whitespace-pre-wrap break-words">
                {latest.value}
                <div className="mt-2 text-[11px] text-text-secondary">آخر تحديث: {latest.updatedAt ? fmtDateStable(latest.updatedAt) : '—'}</div>
              </div>
            ) : (
              <div className="text-text-secondary">لا توجد ملاحظة محفوظة بعد.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
