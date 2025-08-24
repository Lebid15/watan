'use client';
import { useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import { useToast } from '@/context/ToastContext';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(API_ROUTES.auth.forgotPassword, { email });
      setSent(true);
      show('تم الإرسال إن وجد الحساب');
    } catch (e:any) { show(e?.message || 'خطأ'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded shadow p-6">
        <h1 className="text-xl font-semibold mb-4">استعادة كلمة المرور</h1>
        {sent ? (
          <p className="text-sm text-gray-600">إن كان البريد موجوداً ستصلك رسالة تحتوي رابط إعادة التعيين.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">البريد الإلكتروني</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <button disabled={loading} className="w-full bg-sky-600 text-white rounded py-2 disabled:opacity-60">{loading? '...' : 'إرسال رابط'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
