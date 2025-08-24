'use client';
import { useEffect, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';

export default function Page() {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 👈 هنا التصحيح: infoes بدل about
        const r = await api.get<string>(API_ROUTES.site.admin.infoes);
        if (!mounted) return;
        setValue(r.data || '');
      } catch {
        if (!mounted) return;
        setError('تعذّر جلب المحتوى');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    try {
      // 👈 وهنا أيضًا: infoes بدل about
      await api.put(API_ROUTES.site.admin.infoes, { value });
      setSavedAt(new Date().toLocaleString('ar-EG'));
    } catch {
      setError('تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto bg-bg-surface border border-border rounded-2xl shadow">
        <div className="flex items-center justify-between gap-2 p-4 md:p-5 border-b border-border">
          <h1 className="text-lg font-bold text-text-primary">تعليمات (إدارة)</h1>
          {savedAt ? (
            <span className="text-[12px] text-text-secondary">تم الحفظ: {savedAt}</span>
          ) : null}
        </div>

        <div className="p-4 md:p-5 space-y-3">
          {error ? (
            <div className="rounded-md border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <div className="text-xs text-text-secondary">النص الظاهر للمستخدم في صفحة “تعليمات”</div>

          <div className={['rounded-xl border border-border bg-bg-elevated','focus-within:ring-2 focus-within:ring-primary/40 transition-shadow'].join(' ')}>
            {loading ? (
              <div className="p-3 text-text-secondary text-sm">جارِ التحميل…</div>
            ) : (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full min-h-[50vh] md:h-[60vh] p-3 bg-transparent outline-none text-text-primary placeholder:text-text-secondary resize-y"
                placeholder="اكتب نص تعليمات..."
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || loading}
              className="btn btn-primary disabled:opacity-60"
              title="حفظ"
            >
              {saving ? 'جارِ الحفظ…' : 'حفظ'}
            </button>
            <button
              type="button"
              onClick={() => setValue('')}
              disabled={saving || loading}
              className="btn btn-secondary disabled:opacity-60"
              title="تفريغ المحتوى"
            >
              مسح
            </button>
          </div>

          <div className="text-[11px] text-text-secondary text-left ltr">
            {value.length.toLocaleString('ar-EG')} حرف
          </div>
        </div>
      </div>
    </div>
  );
}
