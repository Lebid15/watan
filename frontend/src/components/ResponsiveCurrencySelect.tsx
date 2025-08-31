'use client';

import { useEffect, useState, useCallback } from 'react';

interface Option {
  id: string;
  name: string;
  code: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  label?: string;
}

// مكوّن: يستخدم <select> عادي على الديسكتوب ويحول لقائمة كاملة الشاشة في الجوال/الآيباد
export default function ResponsiveCurrencySelect({ options, value, onChange, placeholder = 'اختر', label }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find(o => o.id === value);

  const detect = useCallback(() => {
    const w = window.innerWidth;
    // نفعّل الواجهة الخاصة تحت 1024 (موبايل + آيباد بوضع عمودي)
    setIsMobile(w < 1024);
  }, []);

  useEffect(() => {
    detect();
    window.addEventListener('resize', detect);
    return () => window.removeEventListener('resize', detect);
  }, [detect]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const filtered = query.trim()
    ? options.filter(o => (o.name + o.code).toLowerCase().includes(query.toLowerCase()))
    : options;

  if (!isMobile) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full mb-2 px-3 py-1 border border-gray-300 rounded bg-white text-black"
      >
        {!value && <option value="" disabled>{placeholder}</option>}
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
        ))}
      </select>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mb-2 px-3 py-2 border border-gray-300 rounded bg-white text-gray-800 text-right"
      >
        {selected ? `${selected.name} (${selected.code})` : <span className="text-gray-500">{placeholder}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-[999] flex flex-col bg-black/50 backdrop-blur-sm">
          <div className="mt-8 mx-auto w-[92%] max-w-md bg-white text-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-gray-50 text-gray-800">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="بحث..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded bg-white text-gray-900 text-sm"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700"
              >إغلاق</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 text-sm text-gray-800">
              {filtered.length === 0 && (
                <div className="p-4 text-center text-gray-500">لا نتائج</div>
              )}
              {filtered.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { onChange(o.id); setOpen(false); setQuery(''); }}
                  className={`w-full text-right px-4 py-3 hover:bg-sky-50 text-gray-800 ${o.id === value ? 'bg-sky-100 font-medium' : ''}`}
                >
                  {o.name} ({o.code})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
