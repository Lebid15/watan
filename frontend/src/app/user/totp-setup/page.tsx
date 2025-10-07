'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/utils/api';
import { useToast } from '@/context/ToastContext';
import Image from 'next/image';

function TotpSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams?.get('next') ?? '/user';
  const nextPath = rawNext.startsWith('/') ? rawNext : '/user';
  const { show } = useToast();
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [credentialId, setCredentialId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setupTotp();
  }, []);

  const setupTotp = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/totp/setup', {
        label: 'My Authenticator',
      });
      
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setCredentialId(data.credentialId);
    } catch (error: any) {
      show(error?.response?.data?.message || 'فشل في إعداد المصادقة الثنائية');
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      show('يرجى إدخال رمز مكون من 6 أرقام');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/totp/verify-setup', {
        token: verificationCode,
        credentialId,
      });
      
      setStep('backup');
    } catch (error: any) {
      show(error?.response?.data?.message || 'رمز التحقق غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const completeSetup = () => {
    show('تم تفعيل المصادقة الثنائية بنجاح');
    router.push(nextPath);
  };

  if (loading && step === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>جاري إعداد المصادقة الثنائية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-bg-surface rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6">
          إعداد المصادقة الثنائية
        </h1>

        {step === 'setup' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-text-secondary mb-4">
                امسح رمز QR باستخدام تطبيق Google Authenticator
              </p>
              {qrCode && (
                <div className="bg-white p-4 rounded-lg inline-block">
                  <Image
                    src={qrCode}
                    alt="QR Code"
                    width={200}
                    height={200}
                    className="mx-auto"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                أو أدخل المفتاح يدوياً:
              </label>
              <div className="bg-bg-surface-alt p-3 rounded border font-mono text-sm break-all">
                {secret}
              </div>
            </div>

            <button
              onClick={() => setStep('verify')}
              className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary-hover"
            >
              التالي
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-text-secondary mb-4">
                أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة
              </p>
            </div>

            <div>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full text-center text-2xl font-mono py-3 border rounded-lg"
                maxLength={6}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('setup')}
                className="flex-1 bg-bg-surface-alt text-text-primary py-3 rounded-lg hover:bg-bg-surface-alt/80"
              >
                السابق
              </button>
              <button
                onClick={verifySetup}
                disabled={loading || verificationCode.length !== 6}
                className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? 'جاري التحقق...' : 'تحقق'}
              </button>
            </div>
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">رموز الاحتياط</h2>
              <p className="text-text-secondary text-sm">
                احفظ هذه الرموز في مكان آمن. يمكن استخدام كل رمز مرة واحدة فقط.
              </p>
            </div>

            <div className="bg-bg-surface-alt p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div key={index} className="text-center py-1">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const text = backupCodes.join('\n');
                  navigator.clipboard.writeText(text);
                  show('تم نسخ الرموز');
                }}
                className="flex-1 bg-bg-surface-alt text-text-primary py-3 rounded-lg hover:bg-bg-surface-alt/80"
              >
                نسخ الرموز
              </button>
              <button
                onClick={completeSetup}
                className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary-hover"
              >
                إنهاء الإعداد
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TotpSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>جاري تحميل الصفحة...</p>
        </div>
      </div>
    }>
      <TotpSetupContent />
    </Suspense>
  );
}
