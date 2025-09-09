'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';
import { ErrorResponse } from '@/types/common';
import { useToast } from '@/context/ToastContext';
import EnableToggleButton from '@/components/EnableToggleButton';

type ProviderKind = 'barakat' | 'apstore' | 'znet' | 'internal';

type Integration = {
  id: string;
  name: string;
  provider: ProviderKind;
  baseUrl?: string;
  apiToken?: string;
  kod?: string;
  sifre?: string;
  enabled?: boolean;
};

export default function EditIntegrationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error: toastError, info } = useToast();

  const [item, setItem] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // changed: numeric balance + error message
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ status?: number; url?: string; body?: string } | null>(null);

  // جلب بيانات المزود
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get<Integration>(API_ROUTES.admin.integrations.byId(String(id)));
        setItem(data);
      } catch (e: unknown) {
        const error = e as ErrorResponse;
        setError(error?.response?.data?.message || error?.message || 'فشل في جلب البيانات');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // دالة جلب الرصيد
  const fetchBalance = useCallback(async (provider: ProviderKind, creds: Record<string, string>, integId: string) => {
    setLoadingBalance(true);
    try {
  const { data } = await api.post<{ balance: number | null; currency?: string | null; error?: string; message?: string }>(
        API_ROUTES.admin.integrations.balance(integId),
        { provider, ...creds }
      );
      const b = typeof data?.balance === 'number' ? data.balance : null;
      setBalance(b);
  setCurrency(b !== null ? (data?.currency ?? null) : null);
      setBalanceError(b === null ? (data?.message || data?.error || null) : null);
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === 'INTEGRATION_DISABLED') {
        info('التكامل معطل');
      } else {
        info('تعذر جلب الرصيد');
      }
  setBalance(null);
  setCurrency(null);
      try { setBalanceError(e?.response?.data?.message || e?.message || null); } catch { setBalanceError(null); }
    } finally {
      setLoadingBalance(false);
    }
  }, [info]);

  const debugBalance = useCallback(async (integId: string) => {
    try {
      const { data } = await api.post<any>(API_ROUTES.admin.integrations.byId(String(integId)) + '/debug-balance', {});
      const A = data?.A || {};
      setDebugInfo({ status: A.status, url: A.finalUrl, body: String(A.bodySnippet || '').slice(0, 200) });
      info('تم تنفيذ اختبار الرصيد');
    } catch (e: any) {
      setDebugInfo({ status: e?.response?.status, url: '', body: String(e?.message || '').slice(0, 200) });
    }
  }, [info]);

  // جلب الرصيد تلقائياً عند تحميل البيانات (إن لم يكن معطل)
  useEffect(() => {
    if (!item || item.enabled === false) return;

    if (item.provider === 'barakat' || item.provider === 'apstore' || item.provider === 'internal') {
      if (item.apiToken) {
        fetchBalance(
          item.provider,
          { apiToken: item.apiToken, baseUrl: item.baseUrl || '' },
          item.id
        );
      }
    } else if (item.provider === 'znet') {
      if (item.kod && item.sifre) {
        fetchBalance(
          item.provider,
          { kod: item.kod, sifre: item.sifre, baseUrl: item.baseUrl || '' },
          item.id
        );
      }
    }
  }, [item, fetchBalance]);

  // زر تحديث الرصيد يدوياً
  const refreshNow = useCallback(() => {
    if (!item || item.enabled === false) return;
    if (item.provider === 'barakat' || item.provider === 'apstore' || item.provider === 'internal') {
      if (item.apiToken) {
        fetchBalance(
          item.provider,
          { apiToken: item.apiToken, baseUrl: item.baseUrl || '' },
          item.id
        );
      }
    } else if (item.provider === 'znet') {
      if (item.kod && item.sifre) {
        fetchBalance(
          item.provider,
          { kod: item.kod, sifre: item.sifre, baseUrl: item.baseUrl || '' },
          item.id
        );
      }
    }
  }, [item, fetchBalance]);

  const onChange = (patch: Partial<Integration>) =>
    setItem((prev) => (prev ? { ...prev, ...patch } : prev));

  const onSave = async () => {
    if (!item) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        name: item.name?.trim(),
        provider: item.provider,
        baseUrl: item.baseUrl || undefined,
        enabled: item.enabled,
      };
      if (item.provider === 'barakat' || item.provider === 'apstore' || item.provider === 'internal') {
        payload.apiToken = item.apiToken || undefined;
      } else if (item.provider === 'znet') {
        payload.kod = item.kod || undefined;
        payload.sifre = item.sifre || undefined;
      }
      await api.put(API_ROUTES.admin.integrations.byId(String(item.id)), payload);
      success('تم الحفظ');
      router.push('/admin/products/api-settings');
    } catch (e: unknown) {
      const err = e as ErrorResponse;
      setError(err?.response?.data?.message || err?.message || 'فشل حفظ التعديلات');
      toastError('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    if (!item) return;
    setToggling(true);
    try {
      const next = !item.enabled;
      await api.put(API_ROUTES.admin.integrations.byId(String(item.id)), { enabled: next });
      setItem((prev) => (prev ? { ...prev, enabled: next } : prev));
      if (!next) setBalance(null);
      if (next) success('تم التفعيل'); else info('تم التعطيل');
    } catch (e: any) {
      toastError('فشل تغيير الحالة');
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <div className="p-4 text-text-primary">يحمل…</div>;
  if (error) return <div className="p-4 text-danger">{error}</div>;
  if (!item) return <div className="p-4 text-text-secondary">لا توجد بيانات</div>;

  return (
    <div className="p-4 md:p-6 text-text-primary">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">تعديل مزود: {item.name}</h1>
        <EnableToggleButton
          enabled={item.enabled !== false}
          loading={toggling}
          onToggle={toggleEnabled}
          size="md"
        />
      </div>

      {/* حالة الرصيد */}
      {item.enabled === false ? (
        <div className="mb-4 card text-text-secondary">التكامل معطل</div>
      ) : loadingBalance ? (
        <div className="mb-4 card border border-accent/40 text-accent">
          جارِ جلب الرصيد…
        </div>
    ) : balance !== null ? (
        <div className="mb-4 card border border-success/40 bg-success/10 text-success">
      الرصيد: {balance}{currency ? ` ${currency}` : ''}
        </div>
      ) : (
        <div className="mb-4 card text-text-secondary">
          لم يتم جلب الرصيد
          {balanceError && <div className="text-[12px] text-warning mt-1">سبب: {String(balanceError)}</div>}
        </div>
      )}
      <div className="mb-4">
        <button onClick={refreshNow} disabled={loadingBalance || item.enabled === false} className="btn btn-secondary">
          {loadingBalance ? 'يحدّث…' : 'تحديث الرصيد'}
        </button>
      </div>

      {/* النموذج */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 card">
        <div>
          <label className="block text-sm mb-1 text-text-secondary">الاسم</label>
          <input
            className="input w-full"
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-text-secondary">النوع</label>
          <select
            className="input w-full"
            value={item.provider}
            onChange={(e) => onChange({ provider: e.target.value as ProviderKind })}
          >
            <option value="barakat">barakat</option>
            <option value="apstore">apstore</option>
            <option value="znet">znet</option>
            <option value="internal">internal</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm mb-1 text-text-secondary">الرابط (Base URL)</label>
          <input
            className="input w-full"
            value={item.baseUrl || ''}
            onChange={(e) => onChange({ baseUrl: e.target.value })}
            placeholder={
              item.provider === 'znet'
                ? 'http://bayi.siteadressinstead.com'
                : item.provider === 'internal'
                ? 'tenant.wtn4.com'
                : 'https://api.x-store.net'
            }
          />
        </div>

        {(item.provider === 'barakat' || item.provider === 'apstore' || item.provider === 'internal') && (
          <div className="md:col-span-2">
            <label className="block text-sm mb-1 text-text-secondary">API Token</label>
            <input
              className="input w-full"
              value={item.apiToken || ''}
              onChange={(e) => onChange({ apiToken: e.target.value })}
              placeholder="أدخل التوكن"
            />
          </div>
        )}

        {item.provider === 'znet' && (
          <>
            <div>
              <label className="block text-sm mb-1 text-text-secondary">رقم الجوال</label>
              <input
                className="input w-full"
                value={item.kod || ''}
                onChange={(e) => onChange({ kod: e.target.value })}
                placeholder="54421999998"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-text-secondary">كلمة السر</label>
              <input
                className="input w-full"
                value={item.sifre || ''}
                onChange={(e) => onChange({ sifre: e.target.value })}
                placeholder="*******"
              />
            </div>
          </>
        )}

        <div className="md:col-span-2 flex items-center gap-2 pt-2">
          <label className="text-sm">مفعل؟</label>
          <input
            type="checkbox"
            checked={item.enabled !== false}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          <span className="text-xs text-text-secondary">(لن يتم تنفيذ أي عمليات عندما يكون معطل)</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="btn bg-success text-text-inverse hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'يحفظ…' : 'حفظ'}
        </button>
        <button
          onClick={() => item && debugBalance(item.id)}
          className="btn btn-secondary"
        >
          اختبار الرصيد
        </button>
        <button
          onClick={() => router.push('/admin/products/api-settings')}
          className="btn btn-secondary"
        >
          رجوع
        </button>
      </div>

      {debugInfo && (
        <div className="mt-3 card text-xs text-text-secondary">
          <div>Debug Status: {debugInfo.status ?? '-'}</div>
          <div>Final URL: {debugInfo.url || '-'}</div>
          <div>Body: {debugInfo.body || '-'}</div>
        </div>
      )}
    </div>
  );
}
