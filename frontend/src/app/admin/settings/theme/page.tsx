// src/app/admin/settings/theme/page.tsx
'use client';

import { useEffect, useState } from 'react';

type ThemeKey = 'light' | 'dark1' | 'dark2' | 'dark3' | 'dark4';

const THEME_ITEMS: {
  key: ThemeKey;
  name: string;
  hintBg: string;
  hintText: string;
  hintBorder: string;
}[] = [
  { key: 'light', name: 'الافتراضي (فاتح)', hintBg: '#ffffff', hintText: '#111827', hintBorder: '#e5e7eb' },
  { key: 'dark1', name: 'Dark 1',            hintBg: '#1f2937', hintText: '#ffffff', hintBorder: '#4b5563' },
  { key: 'dark2', name: 'Dark 2',            hintBg: '#1e293b', hintText: '#ffffff', hintBorder: '#475569' },
  { key: 'dark3', name: 'Dark 3',            hintBg: '#18181b', hintText: '#ffffff', hintBorder: '#3f3f46' },
  { key: 'dark4', name: 'Dark 4',            hintBg: '#309898', hintText: '#ffffff', hintBorder: '#1f6d6d' },
];

export default function AdminThemePage() {
  const [theme, setTheme] = useState<ThemeKey>('light');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // --- helpers ---
  const applyTheme = (t: ThemeKey, opts: { persist?: boolean } = { persist: true }) => {
    const el = document.documentElement;

    // light = الوضع الافتراضي => إزالة الخاصية (متوافق مع بقية الصفحات)
    if (t === 'light') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', t);

    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) meta.content = t === 'light' ? '#ffffff' : '#0F1115';

    if (opts.persist) {
      try { localStorage.setItem('theme', t); } catch {}
    }
  };

  const normalize = (v: string | null | undefined): ThemeKey => {
    if (!v || v === '') return 'light';
    return (['light','dark1','dark2','dark3','dark4'].includes(v) ? (v as ThemeKey) : 'light');
  };

  // --- mount: اقرأ المخزَّن وطبّق ---
  useEffect(() => {
    try {
      const fromAttr = document.documentElement.getAttribute('data-theme');
      const fromLS   = localStorage.getItem('theme');
      const initial  = normalize(fromLS ?? fromAttr);
      setTheme(initial);
      applyTheme(initial, { persist: false }); // لا تعيد الحفظ عند الإقلاع
    } catch {
      setTheme('light');
      applyTheme('light', { persist: false });
    }
  }, []);

  const saveTheme = async (t: ThemeKey) => {
    setTheme(t);
    applyTheme(t, { persist: true });

    // (اختياري) حفظ على الخادم إن أردت لاحقًا
    try {
      setSaving(true);
      setMsg(null);
      // await api.post('/api/admin/settings/theme', { theme: t });
      setMsg('✅ تم تطبيق المظهر');
    } catch {
      setMsg('❌ تعذّر حفظ التفضيل على الخادم، لكن تم تطبيقه محليًا');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 2000);
    }
  };

  return (
    <div className="admin-container py-4">
      <h1 className="text-xl font-bold mb-4">المظهر (الثيم)</h1>

      <div className="bg-bg-surface border border-border rounded-xl p-4 space-y-4">
        <p className="text-text-secondary text-sm">
          اختر مظهر لوحة التحكم. يتم حفظ الاختيار محليًا ويُطبّق مباشرة على واجهة الأدمن.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {THEME_ITEMS.map((t) => {
            const active = t.key === theme;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => saveTheme(t.key)}
                disabled={saving}
                className={[
                  'group relative flex items-center gap-3 px-3 py-2 rounded-lg border transition',
                  active ? 'border-primary bg-primary/10' : 'border-border hover:bg-bg-surface-alt',
                ].join(' ')}
                aria-pressed={active}
              >
                <span
                  className="inline-block w-6 h-6 rounded-full border"
                  style={{
                    background: t.hintBg,
                    borderColor: t.hintBorder,
                    boxShadow: `inset 0 0 0 2px ${t.hintBg === '#ffffff' ? '#f3f4f6' : 'rgba(255,255,255,.06)'}`,
                  }}
                  aria-hidden
                />
                <span className={active ? 'text-text-primary font-medium' : 'text-text-primary'}>
                  {t.name}
                </span>
                {active && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        {msg && (
          <div className={`text-sm ${msg.startsWith('✅') ? 'text-success' : 'text-warning'}`}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
