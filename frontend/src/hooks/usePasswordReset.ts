'use client';
import { useState, useCallback } from 'react';
import api from '@/utils/api';

export function usePasswordReset() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [requested, setRequested] = useState(false);
  const [completed, setCompleted] = useState(false);

  const request = useCallback(async (emailOrUsername: string, tenantCode?: string)=>{
    setLoading(true); setError(null);
    try {
      await api.post('/auth/request-password-reset', { emailOrUsername, tenantCode });
      setRequested(true);
    } catch (e:any) { setError(e?.message || 'فشل الطلب'); throw e; } finally { setLoading(false); }
  }, []);

  const reset = useCallback(async (token: string, newPassword: string)=>{
    setLoading(true); setError(null);
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword }, { validateStatus: () => true });
      if (res.status >= 300) throw new Error((res.data as any)?.message || 'فشل التعيين');
      setCompleted(true);
      return res.data;
    } catch (e:any) { setError(e?.message || 'فشل التعيين'); throw e; } finally { setLoading(false); }
  }, []);

  return { request, reset, requested, completed, loading, error };
}
