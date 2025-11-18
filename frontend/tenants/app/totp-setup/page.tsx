'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/utils/api';
import { useToast } from '@/context/ToastContext';
import Image from 'next/image';

function TotpSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams?.get('next') ?? '/settings/security';
  const nextPath = rawNext.startsWith('/') ? rawNext : '/settings/security';
  const { show } = useToast();
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [credentialId, setCredentialId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setupTotp();
  }, []);

  const setupTotp = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/totp/setup', {
        label: 'My Authenticator',
      });
      
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setCredentialId(data.credentialId);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || 'فشل في إعداد المصادقة الثنائية';
      setError(errorMsg);
      show(errorMsg);
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
    show('تم تفعيل المصادقة الثنائية بنجاح ✅');
    router.push(nextPath);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">جاري إعداد المصادقة الثنائية...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-bg-surface border border-border rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">فشل في إعداد المصادقة</h2>
            <p className="text-text-secondary mb-6">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={setupTotp}
                className="flex-1 bg-primary hover:bg-primary-hover text-primary-contrast py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                إعادة المحاولة
              </button>
              <button
                onClick={() => router.push(nextPath)}
                className="flex-1 bg-bg-surface-hover hover:bg-bg-surface-alt text-text-primary py-3 rounded-lg border border-border font-medium transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full bg-bg-surface border border-border rounded-xl shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            إعداد المصادقة الثنائية
          </h1>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center ${step === 'setup' ? 'text-primary' : 'text-success'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'setup' ? 'bg-primary' : 'bg-success'} text-white font-bold`}>
              {step === 'setup' ? '1' : '✓'}
            </div>
            <span className="ml-2 text-sm font-medium">المسح</span>
          </div>
          <div className={`w-12 h-0.5 mx-2 ${step === 'verify' || step === 'backup' ? 'bg-primary' : 'bg-border'}`}></div>
          <div className={`flex items-center ${step === 'verify' ? 'text-primary' : step === 'backup' ? 'text-success' : 'text-text-secondary'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'verify' ? 'bg-primary text-white' : step === 'backup' ? 'bg-success text-white' : 'bg-bg-surface-alt text-text-secondary'} font-bold`}>
              {step === 'backup' ? '✓' : '2'}
            </div>
            <span className="ml-2 text-sm font-medium">التحقق</span>
          </div>
          <div className={`w-12 h-0.5 mx-2 ${step === 'backup' ? 'bg-primary' : 'bg-border'}`}></div>
          <div className={`flex items-center ${step === 'backup' ? 'text-primary' : 'text-text-secondary'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'backup' ? 'bg-primary text-white' : 'bg-bg-surface-alt text-text-secondary'} font-bold`}>
              3
            </div>
            <span className="ml-2 text-sm font-medium">النسخ الاحتياطي</span>
          </div>
        </div>

        {step === 'setup' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-text-secondary mb-4">
                امسح رمز QR باستخدام تطبيق <span className="font-bold">Google Authenticator</span> أو أي تطبيق مصادقة آخر
              </p>
              {qrCode && (
                <div className="bg-white p-4 rounded-lg inline-block border-2 border-border">
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

            <div className="bg-bg-surface-alt border border-border rounded-lg p-4">
              <label className="block text-sm font-medium text-text-primary mb-2">
                أو أدخل المفتاح يدوياً:
              </label>
              <div className="bg-bg-base p-3 rounded border border-border font-mono text-sm break-all text-text-primary text-center">
                {secret}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(secret);
                  show('تم نسخ المفتاح');
                }}
                className="mt-2 w-full text-sm text-primary hover:text-primary-hover"
              >
                نسخ المفتاح
              </button>
            </div>

            <button
              onClick={() => setStep('verify')}
              className="w-full bg-primary text-primary-contrast py-3 rounded-lg hover:bg-primary-hover font-medium transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              التالي
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-text-secondary mb-4">
                أدخل الرمز المكون من <span className="font-bold">6 أرقام</span> من تطبيق المصادقة
              </p>
            </div>

            <div>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                className="w-full text-center text-3xl font-mono py-4 border-2 border-border bg-bg-input text-text-primary rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                maxLength={6}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('setup')}
                className="flex-1 bg-bg-surface-hover text-text-primary py-3 rounded-lg hover:bg-bg-surface-alt border border-border font-medium transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                السابق
              </button>
              <button
                onClick={verifySetup}
                disabled={loading || verificationCode.length !== 6}
                className="flex-1 bg-primary text-primary-contrast py-3 rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"/>
                    </svg>
                    جاري التحقق...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    تحقق
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-text-primary mb-2">رموز الاحتياط</h2>
              <p className="text-text-secondary text-sm">
                احفظ هذه الرموز في مكان آمن. يمكن استخدام كل رمز <span className="font-bold">مرة واحدة فقط</span>.
              </p>
            </div>

            <div className="bg-bg-base border-2 border-primary/20 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-3 font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div key={index} className="text-center py-2 px-3 bg-bg-surface border border-border rounded text-text-primary font-medium">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>تأكد من حفظ هذه الرموز في مكان آمن قبل المتابعة. لن تتمكن من رؤيتها مرة أخرى!</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const text = backupCodes.join('\n');
                  navigator.clipboard.writeText(text);
                  show('تم نسخ الرموز إلى الحافظة');
                }}
                className="flex-1 bg-bg-surface-hover text-text-primary py-3 rounded-lg hover:bg-bg-surface-alt border border-border font-medium transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                نسخ الرموز
              </button>
              <button
                onClick={completeSetup}
                className="flex-1 bg-success hover:bg-success/90 text-white py-3 rounded-lg font-medium transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">جاري تحميل الصفحة...</p>
        </div>
      </div>
    }>
      <TotpSetupContent />
    </Suspense>
  );
}
