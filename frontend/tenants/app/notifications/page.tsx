'use client';

import { useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import { FiBell, FiSend } from 'react-icons/fi';

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  
  const canSend = title.trim().length > 0 && message.trim().length > 0 && !loading;

  const sendAnnouncement = async () => {
    if (!canSend) {
      setStatus(' يرجى التحقق من الحقول');
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
      setStatus(' تم إرسال الإشعار بنجاح');
      setTitle('');
      setMessage('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || ' فشل في إرسال الإشعار';
      setStatus(typeof msg === 'string' ? msg : ' فشل في إرسال الإشعار');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-bg-base text-text-primary" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-lg">
          <FiBell className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold">إرسال إشعار عام</h1>
      </div>

      {status && (
        <div className={`mb-6 p-4 rounded-xl border-2 font-medium ${status.startsWith('') ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'}`}>
          {status}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              محتوى الإشعار
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-2 text-text-primary">العنوان</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-bg-input text-text-primary focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="اكتب عنوان الإشعار"
                  maxLength={200}
                />
                <div className="text-xs text-text-secondary mt-1 flex justify-between">
                  <span>الحد الأقصى: 200 حرف</span>
                  <span className={title.length > 180 ? 'text-warning' : ''}>{title.length}/200</span>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-2 text-text-primary">النص</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-bg-input text-text-primary focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                  placeholder="اكتب نص الإشعار"
                  maxLength={2000}
                  rows={8}
                />
                <div className="text-xs text-text-secondary mt-1 flex justify-between">
                  <span>الحد الأقصى: 2000 حرف</span>
                  <span className={message.length > 1800 ? 'text-warning' : ''}>{message.length}/2000</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={sendAnnouncement}
            disabled={!canSend}
            className={`w-full py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md ${
              !canSend 
                ? 'bg-bg-surface-alt text-text-secondary cursor-not-allowed border border-border' 
                : 'bg-primary hover:bg-primary-hover text-primary-contrast hover:shadow-lg'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"/>
                </svg>
                جاري الإرسال...
              </>
            ) : (
              <>
                <FiSend />
                إرسال الإشعار
              </>
            )}
          </button>
        </div>

        <div className="lg:sticky lg:top-6 h-fit">
          <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success"></span>
              معاينة الإشعار
            </h2>

            <div className="bg-bg-base border-2 border-primary/20 rounded-xl p-5 min-h-[250px]">
              {title || message ? (
                <div className="space-y-3">
                  {title && (
                    <h3 className="font-bold text-lg text-text-primary">
                      {title}
                    </h3>
                  )}
                  {message && (
                    <p className="text-base text-text-primary whitespace-pre-wrap leading-relaxed">
                      {message}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-secondary text-center py-12">
                  <FiBell className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-sm">المعاينة ستظهر هنا</p>
                </div>
              )}
            </div>

            <div className="mt-4 p-3 bg-bg-surface-alt rounded-lg text-xs text-text-secondary">
              <p className="font-medium mb-1">ℹ ملاحظة:</p>
              <p>سيتم إرسال هذا الإشعار لجميع المستخدمين المسجلين في النظام</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
