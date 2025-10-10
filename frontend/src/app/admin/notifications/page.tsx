// src/app/admin/notifications/page.tsx
'use client';

import { useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const canSend = title.trim().length > 0 && message.trim().length > 0 && !loading;

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
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus('✅ تم إرسال الإشعار بنجاح');
      setTitle('');
      setMessage('');
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
