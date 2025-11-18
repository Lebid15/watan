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
        const { data } = await api.get(API_ROUTES.admin.integrations.byId(String(id))) as any;
        setItem(data as any);
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
  const { data } = await api.post(
        API_ROUTES.admin.integrations.balance(integId),
        { provider, ...creds }
      ) as any;
      const b = typeof (data as any)?.balance === 'number' ? (data as any).balance : null;
      setBalance(b);
  setCurrency(b !== null ? ((data as any)?.currency ?? null) : null);
      setBalanceError(b === null ? ((data as any)?.message || (data as any)?.error || null) : null);
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
      const { data } = await api.post(API_ROUTES.admin.integrations.byId(String(integId)) + '/debug-balance', {}) as any;
      const A = (data as any)?.A || {};
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
      router.push('/products/api-settings');
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

  if (loading) return (
    <div className="p-4 md:p-6 flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl animate-spin">⏳</span>
        <span className="text-text-secondary">يحمل البيانات...</span>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="p-4 md:p-6 min-h-screen">
      <div className="p-4 rounded-xl border-2 border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 flex items-center gap-3">
        <span className="text-2xl">⚠️</span>
        <span>{error}</span>
      </div>
    </div>
  );
  
  if (!item) return (
    <div className="p-4 md:p-6 flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <span className="text-5xl opacity-50">📭</span>
        <span className="text-text-secondary text-lg">لا توجد بيانات</span>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 text-text-primary min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.push('/products/api-settings')}
            className="
              p-2 rounded-lg
              bg-bg-surface border border-border
              hover:bg-bg-surface-alt
              transition-all duration-200
            "
            title="رجوع"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold text-text-primary">تعديل المزود</h1>
        </div>

        <div className="p-4 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔧</span>
            <div>
              <h2 className="text-xl font-bold">{item.name}</h2>
              <span className="text-sm text-text-secondary">
                النوع: <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-medium text-xs uppercase">{item.provider}</span>
              </span>
            </div>
          </div>
          <EnableToggleButton
            enabled={item.enabled !== false}
            loading={toggling}
            onToggle={toggleEnabled}
            size="md"
          />
        </div>
      </div>

      {/* حالة الرصيد */}
      <div className="mb-6">
        {item.enabled === false ? (
          <div className="p-4 rounded-xl border-2 border-gray-400 bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 flex items-center gap-3">
            <span className="text-2xl">⏸️</span>
            <div>
              <div className="font-bold">التكامل معطل</div>
              <div className="text-sm">قم بتفعيل التكامل لجلب الرصيد والبدء بالعمليات</div>
            </div>
          </div>
        ) : loadingBalance ? (
          <div className="p-4 rounded-xl border-2 border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 flex items-center gap-3">
            <span className="text-2xl animate-spin">⏳</span>
            <span className="font-medium">جارِ جلب الرصيد...</span>
          </div>
        ) : balance !== null ? (
          balance === 0 ? (
            <div className="p-4 rounded-xl border-2 border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-bold text-lg">الرصيد: {balance}{currency ? ` ${currency}` : ''}</div>
                <div className="text-sm mt-1">تحذير: الرصيد صفر — لن يتم تنفيذ العمليات</div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border-2 border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <div className="text-sm text-green-600 dark:text-green-500">الرصيد المتاح</div>
                <div className="font-bold text-2xl">{balance}{currency ? ` ${currency}` : ''}</div>
              </div>
            </div>
          )
        ) : (
          <div className="p-4 rounded-xl border border-border bg-bg-surface-alt flex items-center gap-3">
            <span className="text-2xl">❓</span>
            <div className="flex-1">
              <div className="text-text-secondary">لم يتم جلب الرصيد</div>
              {balanceError && (
                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  السبب: {String(balanceError)}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-3">
          <button 
            onClick={refreshNow} 
            disabled={loadingBalance || item.enabled === false} 
            className="
              px-4 py-2 rounded-lg font-medium text-sm
              bg-blue-600 text-white
              hover:bg-blue-700 hover:shadow-md
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              flex items-center gap-2
            "
          >
            <span>🔄</span>
            <span>{loadingBalance ? 'يحدّث...' : 'تحديث الرصيد'}</span>
          </button>
        </div>
      </div>

      {/* النموذج */}
      <div className="p-6 rounded-xl border border-border bg-bg-surface shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">📝</span>
          <h3 className="text-xl font-bold">بيانات الاتصال</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-text-primary">الاسم</label>
            <input
              className="
                w-full px-4 py-2.5 rounded-lg
                bg-bg-input border border-border
                text-text-primary placeholder:text-text-secondary
                focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                transition-all duration-200
              "
              value={item.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="اسم المزود"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-text-primary">النوع</label>
            <select
              className="
                w-full px-4 py-2.5 rounded-lg
                bg-bg-input border border-border
                text-text-primary
                focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                transition-all duration-200
              "
              value={item.provider}
              onChange={(e) => onChange({ provider: e.target.value as ProviderKind })}
            >
              <option value="barakat">Barakat</option>
              <option value="apstore">APStore</option>
              <option value="znet">ZNet</option>
              <option value="internal">Internal</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2 text-text-primary">الرابط (Base URL)</label>
            <input
              className="
                w-full px-4 py-2.5 rounded-lg
                bg-bg-input border border-border
                text-text-primary placeholder:text-text-secondary
                focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                transition-all duration-200
                font-mono text-sm
              "
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
              <label className="block text-sm font-medium mb-2 text-text-primary">API Token</label>
              <input
                className="
                  w-full px-4 py-2.5 rounded-lg
                  bg-bg-input border border-border
                  text-text-primary placeholder:text-text-secondary
                  focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                  transition-all duration-200
                  font-mono text-sm
                "
                value={item.apiToken || ''}
                onChange={(e) => onChange({ apiToken: e.target.value })}
                placeholder="أدخل التوكن"
                type="password"
              />
            </div>
          )}

          {item.provider === 'znet' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2 text-text-primary">رقم الجوال</label>
                <input
                  className="
                    w-full px-4 py-2.5 rounded-lg
                    bg-bg-input border border-border
                    text-text-primary placeholder:text-text-secondary
                    focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                    transition-all duration-200
                  "
                  value={item.kod || ''}
                  onChange={(e) => onChange({ kod: e.target.value })}
                  placeholder="54421999998"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-text-primary">كلمة السر</label>
                <input
                  className="
                    w-full px-4 py-2.5 rounded-lg
                    bg-bg-input border border-border
                    text-text-primary placeholder:text-text-secondary
                    focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                    transition-all duration-200
                  "
                  value={item.sifre || ''}
                  onChange={(e) => onChange({ sifre: e.target.value })}
                  placeholder="*******"
                  type="password"
                />
              </div>
            </>
          )}

          <div className="md:col-span-2 pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled-checkbox"
                checked={item.enabled !== false}
                onChange={(e) => onChange({ enabled: e.target.checked })}
                className="
                  w-5 h-5 rounded
                  border-2 border-primary
                  text-primary focus:ring-2 focus:ring-primary/40
                  cursor-pointer
                "
              />
              <label htmlFor="enabled-checkbox" className="cursor-pointer">
                <span className="font-medium text-text-primary">تفعيل التكامل</span>
                <span className="block text-xs text-text-secondary mt-0.5">
                  (لن يتم تنفيذ أي عمليات عندما يكون معطل)
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="
            px-6 py-3 rounded-lg font-bold text-base
            bg-gradient-to-r from-green-600 to-green-500 text-white
            hover:from-green-700 hover:to-green-600 hover:shadow-lg
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            flex items-center gap-2
          "
        >
          <span className="text-xl">{saving ? '⏳' : '💾'}</span>
          <span>{saving ? 'يحفظ...' : 'حفظ التعديلات'}</span>
        </button>

        <button
          onClick={() => item && debugBalance(item.id)}
          className="
            px-6 py-3 rounded-lg font-medium text-base
            bg-purple-600 text-white
            hover:bg-purple-700 hover:shadow-md
            transition-all duration-200
            flex items-center gap-2
          "
        >
          <span>🧪</span>
          <span>اختبار الرصيد</span>
        </button>

        <button
          onClick={() => router.push('/products/api-settings')}
          className="
            px-6 py-3 rounded-lg font-medium text-base
            bg-gray-200 text-gray-700
            hover:bg-gray-300
            dark:bg-gray-700 dark:text-gray-200
            dark:hover:bg-gray-600
            transition-all duration-200
          "
        >
          رجوع
        </button>
      </div>

      {/* Debug Info */}
      {debugInfo && (
        <div className="mt-6 p-4 rounded-xl border border-border bg-bg-surface-alt">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔍</span>
            <h4 className="font-bold">معلومات الاختبار</h4>
          </div>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex items-start gap-2">
              <span className="text-text-secondary min-w-[100px]">الحالة:</span>
              <span className={`font-medium ${debugInfo.status === 200 ? 'text-green-600' : 'text-red-600'}`}>
                {debugInfo.status ?? '-'}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-text-secondary min-w-[100px]">الرابط:</span>
              <span className="text-text-primary break-all">{debugInfo.url || '-'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-text-secondary min-w-[100px]">الاستجابة:</span>
              <span className="text-text-primary break-all">{debugInfo.body || '-'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
