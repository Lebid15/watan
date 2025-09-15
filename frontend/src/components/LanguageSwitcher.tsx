"use client";
import { useEffect, useState } from 'react';
import i18n, { setLocale, loadNamespace } from '@/i18n/client';

const langs = [
  { code: 'ar', labelKey: 'lang.ar' },
  { code: 'en', labelKey: 'lang.en' },
  { code: 'tr', labelKey: 'lang.tr' },
];

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const current = i18n.language || 'ar';
  const currentObj = langs.find(l => l.code === current) || langs[0];
  const t = (key: string) => (i18n.getResource(current, 'common', key) as string) || key;

  useEffect(() => {
    (async () => {
      await loadNamespace(current, 'common');
      setReady(true);
    })();
  }, [current]);

  const switchTo = async (code: string) => {
    if (code === current) { setOpen(false); return; }
    setLocale(code);
    await loadNamespace(code, 'common');
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} dir="ltr">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-bg-surface-alt border border-border text-xs hover:bg-bg-surface focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-semibold">{current.toUpperCase()}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <ul className="absolute right-0 mt-1 w-36 bg-bg-surface-alt border border-border rounded-md shadow z-50 p-1" role="listbox">
          {langs.map(l => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => switchTo(l.code)}
                className={`w-full text-right text-[12px] px-2 py-1 rounded hover:bg-bg-surface ${l.code === current ? 'text-primary font-semibold' : ''}`}
              >
                {ready ? t(l.labelKey) : l.code}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
