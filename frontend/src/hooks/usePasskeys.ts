'use client';
import { useState, useCallback } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import api from '@/utils/api';

export function usePasskeys() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerPasskey = useCallback(async (label?: string) => {
    setError(null); setLoading(true);
    try {
      const safeLabel = (label || '').trim();
      const { data: options, status } = await api.post<any>('/auth/passkeys/options/register', safeLabel ? { label: safeLabel } : {}, { validateStatus: () => true });
      if (status >= 300) {
        throw new Error(options?.details || options?.message || 'تعذر إنشاء المفتاح');
      }
      if (!options?.challenge || !options?.challengeRef) {
        throw new Error('Missing challenge from server');
      }
      const challengeRef = options.challengeRef;
      
      const attResp = await startRegistration(options);
      
  const verifyRes = await api.post('/auth/passkeys/register', { response: attResp, challengeRef, label: safeLabel }, { validateStatus: () => true });
      if (verifyRes.status >= 300) throw new Error((verifyRes.data as any)?.details || (verifyRes.data as any)?.message || 'فشل التحقق');
      return verifyRes.data;
    } catch (e: any) {
      if (e?.response?.status === 401) {
        setError('يجب تسجيل الدخول أولاً لإنشاء Passkey');
      } else {
        setError(e?.response?.data?.details || e?.message || 'خطأ في إنشاء Passkey');
      }
      throw e;
    } finally { setLoading(false); }
  }, []);

  const authenticateWithPasskey = useCallback(async (emailOrUsername: string) => {
    setError(null); setLoading(true);
    try {
      const { data: optRes } = await api.post<{ options: any; challengeRef: string }>('/auth/passkeys/options/login', { emailOrUsername });
      const { options, challengeRef } = optRes;
      
      const authResp = await startAuthentication(options);
      
      const verifyRes = await api.post<any>('/auth/passkeys/login', { emailOrUsername, response: authResp, challengeRef }, { validateStatus: () => true });
      if (verifyRes.status >= 300 || !(verifyRes.data as any)?.access_token) throw new Error((verifyRes.data as any)?.message || 'فشل تسجيل الدخول');
      
      const token = (verifyRes.data as any).access_token as string;
      if (token && typeof token === 'string') {
        localStorage.setItem('token', token);
        document.cookie = `access_token=${token}; Path=/; Max-Age=${60*60*24*7}`;
      }
      return verifyRes.data;
    } catch (e: any) {
      setError(e?.message || 'خطأ في تسجيل الدخول بـ Passkey');
      throw e;
    } finally { setLoading(false); }
  }, []);

  return { registerPasskey, authenticateWithPasskey, loading, error };
}
