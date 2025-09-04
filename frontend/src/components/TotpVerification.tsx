'use client';

import React, { useState } from 'react';
import api from '@/utils/api';
import { useToast } from '@/context/ToastContext';

interface TotpVerificationProps {
  onSuccess: (token: string) => void; // token parameter kept for compatibility (returns entered code)
  onCancel: () => void;
}

export default function TotpVerification({ onSuccess, onCancel }: TotpVerificationProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const handleVerify = async () => {
    if (!code || code.length < 6) {
      show('يرجى إدخال رمز مكون من 6 أرقام أو رمز احتياطي');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/totp/verify', { token: code });
      if (data.verified) {
        // ترقية التوكن: نقل pre_token إلى token (إن لم يرجع الخادم توكن نهائي)
        let finalToken = data.token;
        try {
          if (!finalToken) {
            // fallback: قد يكون verify أعاد نفس التوكن ضمن data.token لاحقًا
            finalToken = data.token;
          }
          if (!finalToken) {
            finalToken = localStorage.getItem('pre_token') || '';
          }
          if (finalToken) {
            localStorage.setItem('token', finalToken);
            localStorage.removeItem('pre_token');
            document.cookie = `access_token=${finalToken}; Path=/; Max-Age=${60*60*24*7}`;
          }
        } catch {}
        onSuccess(code);
      } else {
        show('رمز التحقق غير صحيح');
      }
    } catch (error: any) {
      if (error?.response?.status === 429) {
        show('تم قفل الحساب مؤقتاً بسبب المحاولات الفاشلة');
      } else {
        show(error?.response?.data?.message || 'خطأ في التحقق');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2 text-black">المصادقة الثنائية</h2>
        <p className="text-sm text-gray-600">أدخل الرمز من تطبيق المصادقة أو استخدم رمزًا احتياطيًا.</p>
      </div>

      <div>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          className="w-full text-center tracking-widest text-2xl font-mono py-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none text-black bg-white"
          maxLength={8}
          autoFocus
        />
        <p className="text-xs text-gray-500 mt-2 text-center">رمز من 6 أرقام أو رمز احتياطي من 8 أحرف</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleVerify}
          disabled={loading || !code}
          className="flex-1 bg-black text-white py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition"
        >
          {loading ? 'جاري التحقق...' : 'تحقق'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-black py-3 rounded-lg hover:bg-gray-300 transition"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
