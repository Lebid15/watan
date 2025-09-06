'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { FiLogOut, FiAlertCircle } from 'react-icons/fi';

type Props = {
  alertMessage?: string; // legacy prop (still supported)
  onLogout: () => void | Promise<void>;
};

interface NoteResp { value: string; updatedAt: string | null }

export default function AdminTopBar({ alertMessage, onLogout }: Props) {
  const [pending, setPending] = useState(false);
  const [devNote, setDevNote] = useState<NoteResp | null>(null);
  const [loadingNote, setLoadingNote] = useState(true);

  // Fetch public developer note (cached server side via service ttl)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<NoteResp>('/dev/notes/public/latest');
        if (!cancelled) setDevNote(res.data);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingNote(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogoutClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onLogout();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative pb-3">
      {(alertMessage || (!!devNote?.value && !loadingNote)) && (
        <div
          className="mr-4 py-3 px-4 pe-10 md:pe-12
                     text-[rgb(var(--color-text-primary))] text-sm opacity-70
                     border border-[rgb(var(--color-border))]
                     rounded-lg flex items-center gap-2 max-w-[55vw] overflow-hidden"
          role="status"
          aria-live="polite"
        >
          <FiAlertCircle className="text-[rgb(var(--color-text-primary))] shrink-0" size={18} />
          <span className="truncate" title={alertMessage || devNote?.value}>
            {alertMessage || devNote?.value}
          </span>
        </div>
      )}

      <button
        onClick={handleLogoutClick}
        disabled={pending}
        className="absolute top-1.5 md:top-2 left-2 md:left-4 
                   bg-red-600 text-white p-2 rounded-xl 
                   hover:bg-red-700 transition
                   disabled:opacity-60 disabled:cursor-not-allowed"
        title="تسجيل الخروج"
        aria-label="تسجيل الخروج"
        aria-busy={pending}
      >
        {pending ? (
          // مؤشر بسيط بدون مكتبات إضافية
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"/>
          </svg>
        ) : (
          <FiLogOut size={20} />
        )}
      </button>
    </div>
  );
}
