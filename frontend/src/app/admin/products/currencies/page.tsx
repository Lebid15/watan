'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { API_ROUTES } from '@/utils/api';

interface Currency {
  id: string;
  name: string;
  code: string;
  rate: number;
  isActive: boolean;
  isPrimary: boolean;
}

const AR_SYMBOLS: Record<string, string> = {
  SYP: 'ل.س', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك', QAR: 'ر.ق', BHD: 'د.ب',
  OMR: 'ر.ع', JOD: 'د.أ', LBP: 'ل.ل', DZD: 'د.ج', MAD: 'د.م', TND: 'د.ت',
  LYD: 'د.ل', IQD: 'د.ع', EGP: 'ج.م', TRY: '₺', USD: '$', EUR: '€', GBP: '£',
};

const NAME_BY_CODE: Record<string, string> = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', TRY: 'Turkish Lira', EGP: 'Egyptian Pound',
  SAR: 'Saudi Riyal', AED: 'UAE Dirham', KWD: 'Kuwaiti Dinar', QAR: 'Qatari Riyal', BHD: 'Bahraini Dinar',
  OMR: 'Omani Rial', JOD: 'Jordanian Dinar', LBP: 'Lebanese Pound', DZD: 'Algerian Dinar',
  MAD: 'Moroccan Dirham', TND: 'Tunisian Dinar', LYD: 'Libyan Dinar', IQD: 'Iraqi Dinar', SYP: 'Syrian Pound',
};

const arabicSymbol = (code?: string) => (code ? (AR_SYMBOLS[code] ?? code) : '');

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addCode, setAddCode] = useState<string>('');
  const [addRate, setAddRate] = useState<string>('1');

  // ضمان إضافة X-Tenant-Host لو فقد (في حالات نادرة) + عدم الاعتماد على تكرار الكود
  const ensureHeaders = (h: Record<string, string> = {}) => {
    if (typeof window !== 'undefined') {
      // لا نضيف Authorization هنا، الـ interceptor في api.ts يتكفل بذلك
      if (!h['X-Tenant-Host']) {
        const host = window.location.host;
        if (host.includes('.localhost')) {
          const sub = host.split('.')[0];
          if (sub && sub !== 'localhost' && sub !== 'www') {
            h['X-Tenant-Host'] = `${sub}.localhost`;
          }
        }
      }
    }
    return h;
  };

  const fetchCurrencies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(API_ROUTES.currencies.base, { headers: ensureHeaders() });
      const raw = res.data as any;
      const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      setCurrencies(list.map((c) => ({ ...c, rate: Number(c.rate) })));
    } catch (e: any) {
      console.warn('[Currencies] fetch failed', e?.response?.status, e?.response?.data);
      setError('فشل في جلب العملات');
      setCurrencies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const existingCodes = new Set(currencies.map((c) => c.code));
  const selectableCodes = Object.keys(NAME_BY_CODE).filter((code) => !existingCodes.has(code));

  const handleChange = (id: string, newRateRaw: string) => {
    const parsed = parseFloat(newRateRaw);
    setCurrencies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, rate: Number.isFinite(parsed) ? parsed : 0 } : c))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(API_ROUTES.currencies.bulkUpdate, { currencies }, { headers: ensureHeaders() });
      alert('تم حفظ التغييرات بنجاح');
    } catch {
      alert('فشل في حفظ التغييرات');
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setAddCode(selectableCodes[0] ?? 'USD');
    setAddRate('1');
    setAddOpen(true);
  };

  const confirmAdd = async () => {
    if (!addCode) return alert('اختر العملة');
    const rateNum = parseFloat(addRate);
    if (!Number.isFinite(rateNum) || rateNum <= 0) return alert('أدخل سعرًا صحيحًا (> 0)');

    const payload: any = {
      code: addCode,
      name: NAME_BY_CODE[addCode] || addCode,
      rate: rateNum,
      isActive: true,
      symbolAr: AR_SYMBOLS[addCode] ?? undefined,
    };

    try {
      await api.post(API_ROUTES.currencies.base, payload, { headers: ensureHeaders() });
      setAddOpen(false);
      await fetchCurrencies();
    } catch {
      alert('فشل في إضافة العملة');
    }
  };

  if (loading) return <p className="text-center mt-4 text-text-primary">جاري التحميل...</p>;
  if (error) return <p className="text-center mt-4 text-danger">{error}</p>;

  return (
    <div className="bg-bg-base p-4 text-text-primary min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">إدارة العملات</h1>
        <button
          onClick={openAdd}
          disabled={selectableCodes.length === 0}
          className="bg-primary hover:bg-primary-hover text-primary-contrast px-4 py-2 rounded transition disabled:opacity-60"
          title={selectableCodes.length === 0 ? 'لا توجد عملات متاحة للإضافة' : 'إضافة عملة جديدة'}
        >
          إضافة عملة جديدة
        </button>
      </div>

      {currencies.length === 0 ? (
        <div className="rounded p-6 text-center bg-bg-surface">
          <p className="mb-2">لا توجد عملات حالياً.</p>
          <p className="mb-4 text-sm text-text-secondary">استخدم زر “إضافة عملة جديدة” بالأعلى لبدء الإضافة.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-border text-sm bg-bg-surface">
              <thead>
                <tr className="bg-bg-surface-alt">
                  <th className="border border-border p-2 text-right">العملة</th>
                  <th className="border border-border p-2 text-right">الكود</th>
                  <th className="border border-border p-2 text-right">رمز العرض (عربي)</th>
                  <th className="border border-border p-2 text-right">سعر مقابل الدولار (1$ = ؟)</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((currency) => (
                  <tr key={currency.id} className="hover:bg-bg-surface-alt">
                    <td className="border border-border p-2">{currency.name}</td>
                    <td className="border border-border p-2">{currency.code}</td>
                    <td className="border border-border p-2 text-center">{arabicSymbol(currency.code)}</td>
                    <td className="border border-border p-2">
                      <input
                        type="number"
                        step="0.0001"
                        value={currency.rate}
                        onChange={(e) => handleChange(currency.id, e.target.value)}
                        className="bg-bg-input border border-border rounded px-2 py-1 w-36 text-center text-text-primary"
                        inputMode="decimal"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-primary-contrast transition disabled:opacity-60"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </>
      )}

      {/* مودال إضافة عملة */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50">
          <div className="bg-bg-surface rounded-lg p-5 w-full max-w-md text-text-primary">
            <h3 className="text-lg font-semibold mb-4">إضافة عملة جديدة</h3>

            <label className="block mb-2">اختر العملة</label>
            <select
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
              className="w-full mb-4 px-3 py-2 border border-border rounded bg-bg-input text-text-primary"
            >
              {selectableCodes.map((code) => (
                <option key={code} value={code}>
                  {NAME_BY_CODE[code] ?? code} ({code})
                </option>
              ))}
            </select>

            <label className="block mb-2">سعر مقابل الدولار (1$ = ؟)</label>
            <input
              type="number"
              step="0.0001"
              value={addRate}
              onChange={(e) => setAddRate(e.target.value)}
              className="w-full mb-6 px-3 py-2 border border-border rounded bg-bg-input text-text-primary"
              placeholder="مثال: 3.7"
              inputMode="decimal"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAddOpen(false)}
                className="px-4 py-2 rounded bg-danger hover:brightness-110 text-text-inverse"
              >
                إلغاء
              </button>
              <button
                onClick={confirmAdd}
                className="px-4 py-2 rounded bg-success hover:brightness-110 text-text-inverse"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
