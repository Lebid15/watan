'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { clearAuthArtifacts } from '@/utils/authCleanup';
import { Api, forceProfileRefresh, resetProfileCache } from '@/utils/api';
import { ErrorResponse } from '@/types/common';

type PriceGroupInfo = {
  id: string;
  name?: string | null;
};

type User = {
  id: string;
  email: string;
  username?: string; // اسم المستخدم (مميز)
  name: string;
  role: string;
  balance: number;
  currency: string; // رمز العملة (مبسّط)
  currencyCode?: string;
  priceGroupId?: string | null;
  priceGroup?: PriceGroupInfo | null;
};

type UserContextType = {
  user: User | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => void;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refreshProfile: async () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Decode basic fallback data from token (for quick painting before profile resolves)
  const decodeTokenFallback = () => {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('token');
    if (!token || !token.includes('.')) return null;
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(atob(b64));
      if (!json?.sub) return null;
      let role = (json.role || 'user').toLowerCase();
      if (['instance_owner','owner','admin'].includes(role)) role = 'tenant_owner';
      return {
        id: json.sub,
        email: json.email || '',
        username: json.username || json.user || '',
        name: json.fullName || json.email || 'User',
        role,
        balance: 0,
        currency: 'USD',
        currencyCode: 'USD',
        priceGroupId: null,
        priceGroup: null,
      } as User;
    } catch { return null; }
  };

  const applyProfileResponse = (data: any) => {
    if (!data) return;
    const currency = (data.currencyCode || data.currency_code || data.currency || 'USD') as string;
    const rawPriceGroup = data.priceGroup || data.price_group || null;
    const priceGroupId = (() => {
      if (data.priceGroupId) return String(data.priceGroupId);
      if (data.price_group_id) return String(data.price_group_id);
      if (rawPriceGroup && rawPriceGroup.id) return String(rawPriceGroup.id);
      const stored = typeof window !== 'undefined' ? window.localStorage?.getItem('userPriceGroupId') : null;
      return stored || null;
    })();
    const priceGroupName = rawPriceGroup?.name ?? data.priceGroupName ?? data.price_group_name ?? null;
    const priceGroup: PriceGroupInfo | null = priceGroupId
      ? { id: priceGroupId, name: priceGroupName != null ? String(priceGroupName) : null }
      : null;

    if (typeof window !== 'undefined') {
      try {
        if (priceGroupId) {
          window.localStorage.setItem('userPriceGroupId', priceGroupId);
        } else {
          window.localStorage.removeItem('userPriceGroupId');
        }
      } catch { /* ignore */ }
    }

    setUser({
      id: String(data.id || ''),
      email: String(data.email || ''),
      username: String((data as any).username || (data as any).userName || ''),
      name: String(data.fullName || data.email || 'User'),
      role: String(data.role || user?.role || 'user'),
      balance: Number(data.balance ?? 0),
      currency,
      currencyCode: currency,
      priceGroupId,
      priceGroup,
    });
  };

  const loadOnce = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path === '/login') { setLoading(false); setUser(null); return; }
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); setUser(null); return; }
    const fallback = decodeTokenFallback();
    if (fallback) setUser(prev => prev || fallback); // paint fallback only if no existing user
    try {
      const res = await Api.me();
      applyProfileResponse(res.data);
    } catch (e) {
      // Api.me handles redirect on auth issues; just ensure state
      const err = e as ErrorResponse;
      if (err?.response?.status && [401,403,404].includes(err.response.status)) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await forceProfileRefresh();
      applyProfileResponse(res.data);
    } catch (e) {
      // ignore, Api handles redirect
    } finally {
      setLoading(false);
    }
  }, []);

  // Legacy refresh alias kept for compatibility (tests may mock refreshUser)
  const refreshUser = () => refreshProfile();

  const logout = () => {
    resetProfileCache();
    setUser(null);
    if (typeof window !== 'undefined') {
      clearAuthArtifacts({ keepTheme: true });
      window.location.replace('/login');
    }
  };

  // تأخير بسيط لإتاحة تهيئة الواجهات / الكوكي قبل الجلب الأول لتقليل 401 وقت التحديث
  useEffect(() => {
    let cancelled = false;
    const run = () => { if (!cancelled) loadOnce(); };
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      const t = setTimeout(run, 120);
      return () => { cancelled = true; clearTimeout(t); };
    }
    const t = setTimeout(run, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [loadOnce]);

  return (
  <UserContext.Provider value={{ user, loading, refreshProfile, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
