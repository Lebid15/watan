'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';
import { ErrorResponse } from '@/types/common';

type ProviderKind = 'barakat' | 'apstore' | 'znet';

type Integration = {
  id: string;
  name: string;
  provider: ProviderKind;
  baseUrl?: string;
  apiToken?: string;
  kod?: string;
  sifre?: string;
};

export default function EditIntegrationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

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
  const fetchBalance = async (provider: ProviderKind, creds: Record<string, string>, integId: string) => {
    setLoadingBalance(true);
    try {
      const { data } = await api.post<{ balance: string }>(
        API_ROUTES.admin.integrations.balance(integId),
        { provider, ...creds }
      );
      setBalance(data.balance);
    } catch {
      setBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  // جلب الرصيد تلقائياً عند تحميل البيانات
  useEffect(() => {
    if (!item) return;

    if (item.provider === 'barakat' || item.provider === 'apstore') {
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
      };
      if (item.provider === 'barakat' || item.provider === 'apstore') {
        payload.apiToken = item.apiToken || undefined;
      } else if (item.provider === 'znet') {
        payload.kod = item.kod || undefined;
        payload.sifre = item.sifre || undefined;
      }
      await api.put(API_ROUTES.admin.integrations.byId(String(item.id)), payload);
      router.push('/admin/products/api-settings');
    } catch (e: unknown) {
      const error = e as ErrorResponse;
      setError(error?.response?.data?.message || error?.message || 'فشل حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-text-primary">يحمل…</div>;
  if (error) return <div className="p-4 text-danger">{error}</div>;
  if (!item) return <div className="p-4 text-text-secondary">لا توجد بيانات</div>;

  return (
    <div className="p-4 md:p-6 text-text-primary">
      <h1 className="text-2xl font-semibold mb-4">تعديل مزود: {item.name}</h1>

      {/* حالة الرصيد */}
      {loadingBalance ? (
        <div className="mb-4 card border border-accent/40 text-accent">
          جارِ جلب الرصيد…
        </div>
      ) : balance !== null ? (
        <div className="mb-4 card border border-success/40 bg-success/10 text-success">
          الرصيد: {balance}
        </div>
      ) : (
        <div className="mb-4 card text-text-secondary">
          لم يتم جلب الرصيد
        </div>
      )}

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
                : 'https://api.x-store.net'
            }
          />
        </div>

        {(item.provider === 'barakat' || item.provider === 'apstore') && (
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
          onClick={() => router.push('/admin/products/api-settings')}
          className="btn btn-secondary"
        >
          رجوع
        </button>
      </div>
    </div>
  );
}
