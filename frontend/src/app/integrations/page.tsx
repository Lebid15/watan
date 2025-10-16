"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';
import { useToast } from '@/context/ToastContext';
import EnableToggleButton from '@/components/EnableToggleButton';

type ProviderKind = 'barakat' | 'apstore' | 'znet' | 'internal';

type IntegrationRow = {
  id: string;
  name: string;
  provider: ProviderKind;
  baseUrl?: string;
  apiToken?: string;
  kod?: string;
  sifre?: string;
  enabled?: boolean;
};

type BalanceInfo = {
  balance: number | null;
  debt?: number | null;
  currency?: string | null | Record<string, any>;
  updatedAt?: string | null;
  error?: string | null;
  message?: string | null;
  debtError?: string | null;
};

export default function AdminIntegrationsPage() {
  const router = useRouter();
  const { success, error: toastError, info, show } = useToast();

  const [items, setItems] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [testing, setTesting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, BalanceInfo | undefined>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // modal state
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    provider: ProviderKind;
    baseUrl: string;
    apiToken: string;
    kod: string;
    sifre: string;
    enabled: boolean;
  }>({
    name: '',
    provider: 'barakat',
    baseUrl: '',
    apiToken: '',
    kod: '',
    sifre: '',
    enabled: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<any>(API_ROUTES.admin.integrations.base);

      // 👇 تطبيع الاستجابة
      const list: IntegrationRow[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];

      setItems(list);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || 'Failed to load integrations'
      );
      setItems([]); // تأكد أنها مصفوفة حتى لا ينهار الـ render
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // جلب الرصيد لكل تكامل مرة واحدة فقط بعد أول تحميل (منع التكرار السريع)
  const fetchedBalancesRef = useRef(false);
  useEffect(() => {
    if (!fetchedBalancesRef.current && items.length > 0) {
      fetchedBalancesRef.current = true;
      items.forEach((it) => it.enabled !== false && handleRefreshBalance(it.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      await api.post(API_ROUTES.admin.integrations.test(id));
    } catch {
      // تجاهل الخطأ هنا
    } finally {
      setTesting(null);
    }
  };

  const handleRefreshBalance = async (id: string) => {
    setRefreshing(id);
    try {
      const { data } = await api.post<{ balance: number | null; debt?: number | null; currency?: string | null; balanceUpdatedAt?: string | null; error?: string | null; message?: string | null; debtError?: string | null }>(
        API_ROUTES.admin.integrations.refreshBalance(id)
      );
      setBalances((b) => ({
        ...b,
        [id]: {
          balance: data?.balance ?? null,
          debt: data?.debt ?? null,
          currency: data?.currency ?? null,
          updatedAt: data?.balanceUpdatedAt ?? null,
          error: data?.error ?? null,
          message: data?.message ?? null,
          debtError: data?.debtError ?? null,
        },
      }));
    } catch {
      setBalances((b) => ({
        ...b,
        [id]: { balance: null, debt: null, error: 'FETCH_FAILED', message: 'تعذّر جلب الرصيد' },
      }));
    } finally {
      setRefreshing(null);
    }
  };
  const formatAmount = (
    value: number | null | undefined,
    rawCurrency: string | null | undefined | Record<string, any>,
    provider?: ProviderKind
  ) => {
    if (value === null || value === undefined) return '—';
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const resolvedCurrency = (() => {
      if (typeof rawCurrency === 'string' && rawCurrency.trim()) {
        return rawCurrency.trim();
      }
      if (rawCurrency && typeof rawCurrency === 'object') {
        const obj = rawCurrency as Record<string, any>;
        for (const key of ['symbol', 'code', 'Code', 'currency']) {
          const val = obj[key];
          if (typeof val === 'string' && val.trim()) return val.trim();
        }
      }
      if (provider === 'internal') return 'USD';
      if (provider === 'znet' || provider === 'apstore' || provider === 'barakat') return 'TRY';
      return '';
    })();

    const currencySymbol = (() => {
      if (!resolvedCurrency) return '';
      if (resolvedCurrency.length === 1 && /[^A-Za-z]/.test(resolvedCurrency)) {
        return resolvedCurrency;
      }
      const lookup: Record<string, string> = {
        USD: '$',
        USDT: '$',
        TRY: '₺',
        TL: '₺',
        EUR: '€',
        GBP: '£',
        SAR: '﷼',
        AED: 'د.إ',
        KWD: 'د.ك',
      };
      return lookup[resolvedCurrency.toUpperCase()] || '';
    })();

    if (currencySymbol) {
      return `${currencySymbol} ${formatted}`;
    }
    return resolvedCurrency ? `${formatted} ${resolvedCurrency}` : formatted;
  };


  const handleDelete = async (id: string) => {
    show('تحذير: سيتم حذف التكامل نهائياً', 'error');
    if (!confirm('هل أنت متأكد من الحذف؟ لا يمكن التراجع.')) return;
    setDeleting(id);
    try {
      await api.delete(API_ROUTES.admin.integrations.byId(id));
      setItems((prev) => prev.filter((x) => x.id !== id));
      info('تم الحذف');
    } catch {
      toastError('فشل الحذف');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (row: IntegrationRow) => {
    setToggling(row.id);
    try {
      await api.put(API_ROUTES.admin.integrations.byId(row.id), { enabled: !row.enabled });
      setItems(prev => prev.map(p => p.id === row.id ? { ...p, enabled: !row.enabled } : p));
      if (row.enabled) info('تم التعطيل'); else success('تم التفعيل');
    } catch (e: any) {
      toastError('فشل تغيير الحالة');
    } finally {
      setToggling(null);
    }
  };

  const goPackages = (id: string) => {
    router.push(`/admin/products/integrations/${id}`);
  };

  const goEdit = (id: string) => {
    router.push(`/admin/integrations/${id}/edit`);
  };

  // submit add integration
  const submitAdd = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload: any = {
        name: form.name.trim(),
        provider: form.provider,
        baseUrl: form.baseUrl || undefined,
        enabled: form.enabled,
      };

      if (form.provider === 'barakat' || form.provider === 'apstore' || form.provider === 'internal') {
        payload.apiToken = form.apiToken || undefined;
      } else if (form.provider === 'znet') {
        payload.kod = form.kod || undefined;
        payload.sifre = form.sifre || undefined;
      }

      await api.post(API_ROUTES.admin.integrations.base, payload);
      setOpenAdd(false);
      setForm({
        name: '',
        provider: 'barakat',
        baseUrl: '',
        apiToken: '',
        kod: '',
        sifre: '',
        enabled: true,
      });
      await load();
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || 'Failed to create integration'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const placeholderForBaseUrl =
    form.provider === 'znet'
      ? 'http://bayi.siteadressinstead.com'
      : form.provider === 'internal'
      ? 'ahmad.syrz1.com'
      : 'https://api.x-stor.net';

  return (
    <div className="p-4 md:p-6 text-text-primary">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">إعدادات API</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="btn btn-primary disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'جاري التحميل..' : 'تحميل'}
          </button>

          <button
            onClick={() => setOpenAdd(true)}
            className="btn btn-primary"
          >
            اضف API
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-md border border-danger/40 bg-danger/10 text-danger">
          {error}
        </div>
      )}

      <div className="overflow-auto border border-border rounded-lg bg-bg-surface">
        <table className="min-w-[900px] w-full text-sm table">
          <thead className="bg-bg-surface-alt">
            <tr>
              <th className="px-3 py-2 font-medium border border-border text-right">الإسم</th>
              <th className="px-3 py-2 font-medium border border-border text-right">النوع</th>
              <th className="px-3 py-2 font-medium border border-border text-right">الرابط</th>
              <th className="px-3 py-2 font-medium border border-border text-right">الحالة</th>
              <th className="px-3 py-2 font-medium border border-border text-right">الرصيد</th>
              <th className="px-3 py-2 font-medium border border-border text-right">العمليات</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-text-secondary"
                >
                  لا يوجد جهات تم الربط معها بعد
                </td>
              </tr>
            )}

            {items.map((it) => (
              <tr
                key={it.id}
                className="border-t border-border bg-bg-surface hover:bg-primary/5"
              >
                <td className="border border-border px-3 py-2">{it.name}</td>
                <td className="border border-border px-3 py-2 uppercase">{it.provider}</td>
                <td className="border border-border px-3 py-2">{it.baseUrl || '—'}</td>
                <td className="border border-border px-3 py-2">
                    <EnableToggleButton
                      enabled={it.enabled}
                      loading={toggling === it.id}
                      onToggle={() => handleToggle(it)}
                      variant="circle"
                      tooltip={it.enabled ? 'مفعل - اضغط للتعطيل' : 'معطل - اضغط للتفعيل'}
                    />
                </td>
                <td className="border border-border px-3 py-2">
                  {it.enabled === false ? '—' : (() => {
                    const info = balances[it.id];
                    if (!info) {
                      return <span className="text-text-secondary">—</span>;
                    }
                    const balanceLabel = formatAmount(info.balance, info.currency, it.provider);
                    const debtLabel = info.debt !== null && info.debt !== undefined
                      ? formatAmount(info.debt, info.currency, it.provider)
                      : null;
                    const metaMessage = info.debtError || info.message || (info.error && info.error !== 'FETCH_FAILED' ? info.error : null);
                    return (
                      <div className="flex flex-col items-end gap-0.5 leading-tight">
                        <span>{balanceLabel}</span>
                        {debtLabel && (
                          <span className="text-xs text-danger">
                            دين: {debtLabel}
                          </span>
                        )}
                        {metaMessage && (
                          <span className="text-xs text-danger/80">
                            {metaMessage}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleTest(it.id)}
                      disabled={testing === it.id || it.enabled === false}
                      className="btn btn-secondary disabled:opacity-50"
                    >
                      {testing === it.id ? 'يختبر..' : 'اختبار'}
                    </button>

                    <button
                      onClick={() => handleRefreshBalance(it.id)}
                      disabled={refreshing === it.id || it.enabled === false}
                      className="btn btn-primary disabled:opacity-50"
                    >
                      {refreshing === it.id ? 'يتم التحديث..' : 'تحديث'}
                    </button>

                    <button
                      onClick={() => goPackages(it.id)}
                      disabled={it.enabled === false}
                      className="btn bg-success text-text-inverse hover:brightness-110 disabled:opacity-40"
                    >
                      ربط
                    </button>

                    <button
                      onClick={() => goEdit(it.id)}
                      className="btn bg-warning text-text-inverse hover:brightness-110"
                    >
                      تعديل
                    </button>

                    <button
                      onClick={() => handleDelete(it.id)}
                      disabled={deleting === it.id}
                      className="btn bg-danger text-text-inverse hover:brightness-110 disabled:opacity-50"
                    >
                      {deleting === it.id ? 'يحذف..' : 'حذف'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-secondary">
                  يحمل...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal إضافة تكامل */}
      {openAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-bg-surface text-text-primary shadow-lg border border-border">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Integration</h2>
              <button
                onClick={() => setOpenAdd(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm mb-1">الاسم</label>
                <input
                  className="input w-full"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="هذه الاسم خاص بك"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">اختر الجهة</label>
                <select
                  className="input w-full"
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value as ProviderKind })
                  }
                >
                  <option value="barakat">barakat</option>
                  <option value="apstore">apstore</option>
                  <option value="znet">znet</option>
                  <option value="internal">internal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">الرابط</label>
                <input
                  className="input w-full"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder={placeholderForBaseUrl}
                />
              </div>

              {(form.provider === 'barakat' || form.provider === 'apstore' || form.provider === 'internal') && (
                <div>
                  <label className="block text-sm mb-1">API Token</label>
                  <input
                    className="input w-full"
                    value={form.apiToken}
                    onChange={(e) => setForm({ ...form, apiToken: e.target.value })}
                    placeholder="ادخل التوكن"
                  />
                </div>
              )}

              {form.provider === 'znet' && (
                <>
                  <div>
                    <label className="block text-sm mb-1">رقم الجوال</label>
                    <input
                      className="input w-full"
                      value={form.kod}
                      onChange={(e) => setForm({ ...form, kod: e.target.value })}
                      placeholder="54421999998"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">كلمة السر</label>
                    <input
                      className="input w-full"
                      value={form.sifre}
                      onChange={(e) => setForm({ ...form, sifre: e.target.value })}
                      placeholder="*******"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 pt-1">
                <label className="text-sm">Enabled</label>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="h-4 w-4"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setOpenAdd(false)}
                className="btn btn-secondary"
              >
                إلغاء
              </button>
              <button
                onClick={submitAdd}
                disabled={submitting || !form.name.trim() || !form.baseUrl.trim()}
                className="btn btn-primary disabled:opacity-50"
              >
                {submitting ? 'يحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
