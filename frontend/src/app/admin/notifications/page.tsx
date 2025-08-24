// src/app/admin/notifications/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api, { API_ROUTES } from '@/utils/api';

const VIEWPORT_PADDING = 8;

function computeMenuPos(btn: HTMLButtonElement | null, minWidth = 180) {
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const width = Math.max(r.width, minWidth);
  let preferredLeft = r.right - width; // RTL: محاذاة يمين
  const left = Math.min(Math.max(preferredLeft, VIEWPORT_PADDING), vw - width - VIEWPORT_PADDING);
  const top = Math.round(r.bottom + 6);
  return { top, left, width };
}

type DropOption<T extends string> = { value: T; label: string };

function useDropdown<T extends string>() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const openMenu = (minWidth?: number) => {
    const p = computeMenuPos(btnRef.current, minWidth);
    if (p) { setPos(p); setOpen(true); }
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      const insideBtn = btnRef.current?.contains(t);
      const insideMenu = menuRef.current?.contains(t);
      if (!insideBtn && !insideMenu) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => {
      const p = computeMenuPos(btnRef.current);
      p && setPos(p);
    };
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, { passive: true });
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition);
    };
  }, [open]);

  return { open, setOpen, btnRef, menuRef, pos, openMenu };
}

function Dropdown<T extends string>({
  label, value, onChange, options, minWidth = 200,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: DropOption<T>[];
  minWidth?: number;
}) {
  const { open, setOpen, btnRef, menuRef, pos, openMenu } = useDropdown<T>();
  const currentLabel = useMemo(() => options.find(o => o.value === value)?.label ?? '', [options, value]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => openMenu(minWidth)}
        className="inline-flex items-center gap-2 border border-border rounded px-3 py-2 bg-bg-surface-alt text-text-primary"
      >
        <span className="text-sm">{label}</span>
        <span className="text-sm opacity-80">{currentLabel}</span>
        <span className="opacity-60">▾</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, minWidth), zIndex: 1000 }}
          className="menu max-h-72 overflow-auto" /* يستخدم .menu من الـ CSS */
          dir="rtl"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-right px-3 py-2 text-sm ${
                value === opt.value ? 'bg-primary/10 text-text-primary' : 'hover:bg-bg-surface-alt'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [channel, setChannel] = useState<'in_app' | 'email' | 'sms'>('in_app');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const channelOptions: DropOption<typeof channel>[] = [
    { value: 'in_app', label: 'داخل التطبيق' },
    { value: 'email',  label: 'بريد إلكتروني' },
    { value: 'sms',    label: 'رسالة SMS' },
  ];
  const priorityOptions: DropOption<typeof priority>[] = [
    { value: 'low',    label: 'منخفضة' },
    { value: 'normal', label: 'عادية' },
    { value: 'high',   label: 'عالية' },
  ];

  const linkValid = useMemo(() => {
    const v = link.trim();
    if (!v) return true;
    return /^\/[^\s]*$/.test(v) || /^https?:\/\/[^\s]+$/i.test(v);
  }, [link]);

  const canSend = useMemo(() => {
    return title.trim().length > 0 && message.trim().length > 0 && linkValid && !loading;
  }, [title, message, linkValid, loading]);

  const sendAnnouncement = async () => {
    if (!canSend) {
      setStatus('❌ يرجى التحقق من الحقول');
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const token = localStorage.getItem('token');
      await api.post(
        `${API_ROUTES.notifications.announce}`,
        {
          title: title.trim(),
          message: message.trim(),
          link: link.trim() ? link.trim() : null,
          channel,
          priority,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus('✅ تم إرسال الإشعار بنجاح');
      setTitle('');
      setMessage('');
      setLink('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '❌ فشل في إرسال الإشعار';
      setStatus(typeof msg === 'string' ? msg : '❌ فشل في إرسال الإشعار');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl p-4 bg-bg-base text-text-primary" dir="rtl">
      <h1 className="text-lg font-bold mb-4">إرسال إشعار عام</h1>

      {status && (
        <div className={`mb-4 p-2 rounded ${status.startsWith('✅') ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {status}
        </div>
      )}

      <div className="mb-4">
        <label className="block font-medium mb-1 text-text-primary">العنوان</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input w-full bg-bg-input border-border text-text-primary"
          placeholder="اكتب عنوان الإشعار"
          maxLength={200}
        />
        <div className="text-xs text-text-secondary mt-1">{title.length}/200</div>
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1 text-text-primary">النص</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="input w-full h-28 bg-bg-input border-border text-text-primary"
          placeholder="اكتب نص الإشعار"
          maxLength={2000}
        />
        <div className="text-xs text-text-secondary mt-1">{message.length}/2000</div>
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1 text-text-primary">الرابط (اختياري)</label>
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className={`input w-full bg-bg-input border-border text-text-primary ${link && !linkValid ? 'border-danger' : ''}`}
          placeholder="مثال داخلي: /orders/123 — مثال خارجي: https://example.com"
        />
        {!linkValid && <div className="text-xs text-danger mt-1">صيغة الرابط غير صحيحة</div>}
      </div>

      <div className="mb-5 flex flex-wrap gap-3 items-center">
        <Dropdown label="القناة" value={channel} onChange={setChannel} options={channelOptions} minWidth={220} />
        <Dropdown label="الأولوية" value={priority} onChange={setPriority} options={priorityOptions} minWidth={200} />
      </div>

      <button
        onClick={sendAnnouncement}
        disabled={!canSend}
        className={`btn ${!canSend ? 'btn-secondary text-text-secondary cursor-not-allowed' : 'btn-primary hover:bg-primary-hover text-primary-contrast'}`}
      >
        {loading ? 'جاري الإرسال...' : 'إرسال الإشعار'}
      </button>
    </div>
  );
}
