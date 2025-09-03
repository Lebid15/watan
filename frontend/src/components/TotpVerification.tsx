'use client';

import React, { useState } from 'react';
import api from '@/utils/api';
import { useToast } from '@/context/ToastContext';

interface TotpVerificationProps {
  onSuccess: (token: string) => void;
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
      const { data } = await api.post('/auth/totp/verify', {
        token: code,
      });

      if (data.verified) {
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
        <h2 className="text-xl font-semibold mb-2">المصادقة الثنائية</h2>
        <p className="text-text-secondary">
          أدخل الرمز من تطبيق المصادقة أو استخدم رمز احتياطي
        </p>
      </div>

      <div>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="123456"
          className="w-full text-center text-2xl font-mono py-3 border rounded-lg"
          maxLength={8}
          autoFocus
        />
        <p className="text-xs text-text-secondary mt-2 text-center">
          رمز من 6 أرقام أو رمز احتياطي من 8 أحرف
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 bg-bg-surface-alt text-text-primary py-3 rounded-lg hover:bg-bg-surface-alt/80"
        >
          إلغاء
        </button>
        <button
          onClick={handleVerify}
          disabled={loading || !code}
          className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? 'جاري التحقق...' : 'تحقق'}
        </button>
      </div>
    </div>
  );
}
