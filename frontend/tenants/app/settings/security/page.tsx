'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import api from '@/utils/api';
import { useToast } from '@/context/ToastContext';

interface StatusResp { enabled: boolean }

export default function SecurityPage(){
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [disabling, setDisabling] = useState(false);

  async function load(){
    setLoading(true);
    try {
      const { data } = await api.get<StatusResp>('/auth/totp/status');
      setEnabled(!!data.enabled);
    } catch (e:any){
      show(e?.response?.data?.message || 'فشل جلب الحالة');
    } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); },[]);

  async function startSetup(){
    const nextTarget = '/settings/security';
    const setupPath = '/totp-setup';
    window.location.href = `${setupPath}?next=${encodeURIComponent(nextTarget)}`;
  }

  async function disableTotp(){
    if(!confirm('هل تريد تعطيل المصادقة الثنائية؟')) return;
    setDisabling(true);
    try { 
      await api.post('/auth/totp/disable'); 
      show('تم التعطيل'); 
      setEnabled(false); 
      setCodes(null); 
    }
    catch(e:any){ 
      show(e?.response?.data?.message || 'فشل التعطيل'); 
    }
    finally { setDisabling(false); }
  }

  async function regenerateCodes(){
    setRegenLoading(true);
    try { 
      const { data } = await api.post('/auth/totp/recovery-codes/regenerate'); 
      setCodes(data.codes||[]); 
      show('تم إنشاء رموز جديدة'); 
    }
    catch(e:any){ 
      show(e?.response?.data?.message || 'فشل إنشاء الرموز'); 
    }
    finally { setRegenLoading(false); }
  }

  return (
    <div className="min-h-screen bg-bg-base p-4 md:p-6" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            🔒 الأمان
          </h1>
          <p className="text-text-secondary text-sm mt-1">إدارة إعدادات الأمان والمصادقة الثنائية</p>
        </div>

        {loading ? (
          <div className="bg-bg-surface border border-border rounded-xl p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-text-secondary">جاري التحميل...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {!enabled && (
              <div className="bg-bg-surface border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-text-primary mb-2">تفعيل المصادقة الثنائية (TOTP)</h2>
                    <p className="text-sm text-text-secondary mb-4">
                      احمِ حسابك بطبقة أمان إضافية. ننصح بشدة بتفعيل المصادقة الثنائية لحماية بياناتك.
                    </p>
                    <button 
                      onClick={startSetup} 
                      className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-primary-contrast rounded-lg font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      ابدأ التفعيل الآن
                    </button>
                  </div>
                </div>
              </div>
            )}

            {enabled && (
              <div className="bg-bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="bg-success/10 border-b border-success/20 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="font-bold text-success">المصادقة الثنائية مفعّلة</h2>
                        <p className="text-sm text-text-secondary mt-0.5">حسابك محمي بطبقة أمان إضافية</p>
                      </div>
                    </div>
                    <button 
                      disabled={disabling} 
                      onClick={disableTotp} 
                      className="px-4 py-2 rounded-lg bg-danger hover:bg-danger-hover text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {disabling ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"/>
                          </svg>
                          جاري التعطيل...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          تعطيل
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    الرموز الاحتياطية
                  </h3>
                  <p className="text-sm text-text-secondary mb-4">
                    استخدم هذه الرموز إذا فقدت الوصول لتطبيق المصادقة. كل رمز يُستخدم مرة واحدة فقط.
                  </p>
                  
                  {codes ? (
                    <div className="space-y-4">
                      <div className="bg-bg-base border border-border rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                          {codes.map(c => (
                            <div key={c} className="px-3 py-2 rounded bg-bg-surface border border-border text-center text-text-primary font-medium">
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={()=> { 
                            navigator.clipboard.writeText(codes.join('\n')); 
                            show('تم نسخ الرموز إلى الحافظة'); 
                          }} 
                          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-contrast font-medium transition-all flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          نسخ الرموز
                        </button>
                        <button 
                          onClick={()=> setCodes(null)} 
                          className="px-4 py-2 rounded-lg bg-bg-surface-hover hover:bg-bg-surface-alt border border-border text-text-primary font-medium transition-all flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                          إخفاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      disabled={regenLoading} 
                      onClick={regenerateCodes} 
                      className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-contrast font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {regenLoading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"/>
                          </svg>
                          جاري الإنشاء...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          إنشاء / إعادة توليد الرموز
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
