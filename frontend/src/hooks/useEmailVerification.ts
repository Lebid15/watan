'use client';
import { useState, useCallback } from 'react';
import api from '@/utils/api';

export function useEmailVerification() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [requested, setRequested] = useState(false);
  const [verified, setVerified] = useState(false);

  const request = useCallback(async ()=>{
    setLoading(true); setError(null);
    try {
      await api.post('/auth/request-email-verification', {});
      setRequested(true);
    } catch (e:any) { setError(e?.message || 'فشل الطلب'); throw e; } finally { setLoading(false); }
  }, []);

  const verify = useCallback(async (token: string)=>{
    setLoading(true); setError(null);
    try {
      const res = await api.post('/auth/verify-email', { token }, { validateStatus: () => true });
      if (res.status >= 300) throw new Error((res.data as any)?.message || 'فشل التحقق');
      setVerified(true);
      return res.data;
    } catch (e:any) { setError(e?.message || 'فشل التحقق'); throw e; } finally { setLoading(false); }
  }, []);

  return { request, verify, requested, verified, loading, error };
}
