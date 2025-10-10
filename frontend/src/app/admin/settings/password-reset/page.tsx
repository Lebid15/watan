'use client';
import React, { useState } from 'react';
import api from '@/utils/api';

export default function AdminPasswordResetPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSendReset = async () => {
    if (!email.trim()) {
      setMessage('يرجى إدخال البريد الإلكتروني');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await api.post('/auth/request-password-reset', { emailOrUsername: email });
      setMessage('تم إرسال رابط إعادة التعيين بنجاح');
      setEmail('');
    } catch (error: any) {
      if (error?.code === 'ERR_NETWORK') {
        setMessage('تعذّر الاتصال بخدمة إعادة التعيين. تأكد من تشغيل خادم Django ثم أعد المحاولة.');
        return;
      }
      setMessage(error?.response?.data?.message || 'فشل في إرسال رابط إعادة التعيين');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">إعادة تعيين كلمة المرور</h1>
      <div className="bg-bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">إرسال رابط إعادة التعيين</h2>
        <p className="text-text-secondary mb-4">
          يمكنك إرسال رابط إعادة تعيين كلمة المرور لأي مستخدم في المتجر
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              البريد الإلكتروني أو اسم المستخدم
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-bg-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="example@mail.com"
            />
          </div>
          {message && (
            <div className={`p-3 rounded-md ${message.includes('نجاح') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message}
            </div>
          )}
          <button
            onClick={handleSendReset}
            disabled={loading || !email.trim()}
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'يرسل...' : 'إرسال رابط إعادة التعيين'}
          </button>
        </div>
      </div>
    </div>
  );
}
