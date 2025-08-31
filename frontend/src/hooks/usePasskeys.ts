'use client';
import { useState, useCallback } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import api from '@/utils/api';

// كشف نمط المسارات: null (غير محدد بعد) | 'new' | 'legacy'
let endpointMode: 'new' | 'legacy' | null = null;

export function usePasskeys() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerPasskey = useCallback(async (label?: string) => {
    setError(null); setLoading(true);
    try {
      // 1) جرّب المسار المُحدّد مسبقاً (إن وُجد) أو جرّب الجديد أولاً ثم ارجع للقديم عند 404/400 المميز
  // جرّب أولاً المسارات القديمة لأنها المتوفرة حالياً في الخادم
  const tryLegacy = endpointMode !== 'new';
  const tryNew = endpointMode !== 'legacy';
  let challengeRef: string | null = null; let options: any = null; let usedMode: 'new' | 'legacy' | null = null;
      let attResp: any; let verifyRes: any;

      let firstError: any = null;
      if (tryLegacy) {
        try {
          const { data: optRes } = await api.post<{ options: any; challengeRef: string }>('/auth/passkeys/options/register', {}, { validateStatus: () => true });
          if (optRes?.options) {
            ({ options, challengeRef } = optRes); usedMode = 'legacy';
          } else throw new Error('Unexpected response (legacy options)');
        } catch (e2:any) {
          firstError = e2;
        }
      }
      if (!options && tryNew) {
        try {
          const { data: optRes } = await api.post<{ options: any; challengeRef: string }>('/auth/passkeys/registration/options', {}, { validateStatus: () => true });
          if (optRes?.options) {
            ({ options, challengeRef } = optRes); usedMode = 'new';
          } else {
            throw new Error('Unexpected response (new options)');
          }
        } catch (e:any) {
          if (!firstError) firstError = e;
        }
      }
  if (!options || !challengeRef || !usedMode) throw firstError || new Error('Failed to obtain registration options');

      attResp = await startRegistration(options);

  if (usedMode === 'new') {
        verifyRes = await api.post('/auth/passkeys/registration/verify', { response: attResp, challengeRef, label }, { validateStatus: () => true });
        endpointMode = 'new';
      } else {
        verifyRes = await api.post('/auth/passkeys/register', { response: attResp, challengeRef, label }, { validateStatus: () => true });
        endpointMode = 'legacy';
      }
      if (verifyRes.status >= 300) throw new Error((verifyRes.data as any)?.message || 'فشل التحقق');
      return verifyRes.data;
    } catch (e: any) {
      setError(e?.message || 'خطأ في إنشاء Passkey');
      throw e;
    } finally { setLoading(false); }
  }, []);

  const authenticateWithPasskey = useCallback(async (emailOrUsername: string) => {
    setError(null); setLoading(true);
    try {
  const tryLegacy = endpointMode !== 'new';
  const tryNew = endpointMode !== 'legacy';
  let challengeRef: string | null = null; let options: any = null; let usedMode: 'new' | 'legacy' | null = null;
      let firstError: any = null;
      if (tryLegacy) {
        try {
          const { data: optRes } = await api.post<{ options: any; challengeRef: string }>('/auth/passkeys/options/login', { emailOrUsername }, { validateStatus: () => true });
          if (optRes?.options) { ({ options, challengeRef } = optRes); usedMode = 'legacy'; }
          else throw new Error('Unexpected response (legacy auth options)');
        } catch (e2:any) { if (!firstError) firstError = e2; }
      }
      if (!options && tryNew) {
        try {
          const { data: optRes } = await api.post<{ options: any; challengeRef: string }>('/auth/passkeys/authentication/options', { emailOrUsername }, { validateStatus: () => true });
          if (optRes?.options) { ({ options, challengeRef } = optRes); usedMode = 'new'; }
          else throw new Error('Unexpected response (new auth options)');
        } catch (e:any) { if (!firstError) firstError = e; }
      }
  if (!options || !challengeRef || !usedMode) throw firstError || new Error('Failed to obtain authentication options');

      const authResp = await startAuthentication(options);
      let verifyRes;
      if (usedMode === 'new') {
        verifyRes = await api.post<any>('/auth/passkeys/authentication/verify', { emailOrUsername, response: authResp, challengeRef }, { validateStatus: () => true });
        endpointMode = 'new';
      } else {
        verifyRes = await api.post<any>('/auth/passkeys/login', { emailOrUsername, response: authResp, challengeRef }, { validateStatus: () => true });
        endpointMode = 'legacy';
      }
      if (verifyRes.status >= 300 || !(verifyRes.data as any)?.access_token) throw new Error((verifyRes.data as any)?.message || 'فشل تسجيل الدخول');
      const token = (verifyRes.data as any).access_token as string;
      localStorage.setItem('token', token);
      document.cookie = `access_token=${token}; Path=/; Max-Age=${60*60*24*7}`;
      return verifyRes.data;
    } catch (e: any) {
      setError(e?.message || 'خطأ في تسجيل الدخول بـ Passkey');
      throw e;
    } finally { setLoading(false); }
  }, []);

  return { registerPasskey, authenticateWithPasskey, loading, error };
}
