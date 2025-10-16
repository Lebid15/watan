// src/app/payments/deposits/[methodId]/page.tsx  ← عدّل المسار حسب مشروعك
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';
import { useTranslation } from 'react-i18next';

type PaymentMethodType = 'CASH_BOX' | 'BANK_ACCOUNT' | 'HAND_DELIVERY' | 'USDT' | 'MONEY_TRANSFER';

interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  logoUrl?: string | null;
  note?: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
}

type PaymentMethodApi = PaymentMethod & { logo_url?: string | null };

interface CurrencyRow {
  id?: string;
  code: string;          // مثل USD, TRY, EUR, SYP
  rate?: number;         // القيمة مقابل 1 USD (إن وُجد)
  value?: number;        // بديل محتمَل
  price?: number;        // بديل محتمَل
}

interface ProfileWithCurrency {
  id: string;
  email: string;
  currencyCode?: string;
}

const valueOf = (c: CurrencyRow): number => {
  const n = Number(c.rate ?? c.value ?? c.price ?? 0);
  return isFinite(n) && n > 0 ? n : 0;
};

function resolveLogoUrl(raw: string | null | undefined, apiHost: string): string {
  if (!raw) return '/images/placeholder.png';
  const value = String(raw).trim();
  if (!value) return '/images/placeholder.png';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  if (!apiHost) return path;
  return `${apiHost}${path}`;
}

const normalizeMethod = (item: PaymentMethodApi | null | undefined): PaymentMethod | null => {
  if (!item) return null;
  const { logo_url, logoUrl, ...rest } = item;
  return { ...rest, logoUrl: logoUrl ?? logo_url ?? null };
};

export default function DepositCreatePage() {
  const { methodId } = useParams<{ methodId: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [profile, setProfile] = useState<ProfileWithCurrency | null>(null);

  const [amount, setAmount] = useState<string>('');             // المبلغ المُرسل
  const [fromCurrency, setFromCurrency] = useState<string>(''); // العملة المُرسلة
  const [note, setNote] = useState<string>('');                 // ملاحظة اختيارية

  const apiHost = useMemo(() => {
    const base = API_ROUTES.payments.methods.active;
    try {
      return new URL(base).origin;
    } catch {
      const trimmed = base.replace(/\/api[^]*$/i, '').replace(/\/$/, '');
      if (trimmed) return trimmed;
      if (typeof window !== 'undefined') return window.location.origin;
      return '';
    }
  }, []);

  // خريطة: code -> rate مقابل 1 USD
  const currencyMap = useMemo(() => {
    const m: Record<string, number> = {};
    currencies.forEach((c) => (m[c.code] = valueOf(c)));
    return m;
  }, [currencies]);

  // إن لم يأتِ walletCurrency من البروفايل، نختار SYP إن وُجدت، وإلا أول عملة.
const walletCurrency = useMemo(() => {
  const fromProfile = profile?.currencyCode?.toUpperCase().trim();
  if (fromProfile) return fromProfile;

  // احتياط: خذها من localStorage إن كانت محفوظة
  if (typeof window !== 'undefined') {
    const ls = localStorage.getItem('userCurrencyCode');
    if (ls) return ls.toUpperCase();
  }

  // آخر حل: أول عملة في القائمة
  return currencies[0]?.code || '';
}, [profile, currencies]);

  // السعر المستخدم للتحويل: amount × (rate[WALLET] / rate[FROM])
  const rateUsed = useMemo(() => {
    const rFrom = currencyMap[fromCurrency];
    const rTo = currencyMap[walletCurrency];
    if (!rFrom || !rTo) return 0;
    return rTo / rFrom;
  }, [currencyMap, fromCurrency, walletCurrency]);

  const convertedAmount = useMemo(() => {
    const a = Number(amount);
    if (!a || !rateUsed) return 0;
    return a * rateUsed;
  }, [amount, rateUsed]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');

      // 1) الوسائل الفعّالة ثم اختر الوسيلة المطلوبة
  const methodsRes = await api.get<PaymentMethodApi[]>(API_ROUTES.payments.methods.active);
  const allMethods = Array.isArray(methodsRes.data) ? methodsRes.data : [];
  const current = normalizeMethod(allMethods.find((m) => m.id === methodId));
  setMethod(current);

      // 2) بروفايل المستخدم
      const profRes = await api.get<ProfileWithCurrency>(API_ROUTES.users.profileWithCurrency);
      setProfile(profRes.data || null);

      // 3) العملات
      const currRes = await api.get<CurrencyRow[]>(API_ROUTES.currencies.base);
      const list = Array.isArray(currRes.data) ? currRes.data : [];
      setCurrencies(list);

      // افتراضيًا اختر USD إن وُجد، وإلا أول عملة متاحة
      const defaultFrom =
        list.find((c) => c.code === 'USD')?.code ||
        list[0]?.code ||
        '';
      setFromCurrency(defaultFrom);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || t('product.status.loading');
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodId]);

  const submitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (!method) throw new Error(t('payments.deposits.method.notFoundDetailed'));
      const a = Number(amount);
      if (!a || a <= 0) throw new Error(t('users.topup.errors.invalidAmount'));

      await api.post(API_ROUTES.payments.deposits.create, {
        methodId: method.id,
        originalAmount: a,
        originalCurrency: fromCurrency,
        walletCurrency,
        note: note || undefined,
      });

      alert(t('payments.deposits.method.success'));
      router.push('/wallet');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || t('payments.deposits.action.genericFail');
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 max-w-2xl mx-auto bg-bg-base text-text-primary" dir="rtl">
      <button
        onClick={() => history.back()}
        className="btn btn-ghost mb-3"
        type="button"
      >
        ← {t('users.detail.back')}
      </button>

      <h1 className="text-lg sm:text-xl font-bold mb-2">{t('payments.deposits.method.pageTitle')}</h1>

      {loading ? (
        <div className="text-text-secondary">{t('product.status.loading')}</div>
      ) : !method ? (
        <div className="text-danger">{t('payments.deposits.method.notFound')}</div>
      ) : (
        <>
          {/* بطاقة وسيلة الدفع */}
          <div className="rounded-xl border border-border bg-subnav text-text-primary p-3 mb-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveLogoUrl(method.logoUrl, apiHost)}
                alt={method.name}
                className="w-12 h-12 object-contain rounded bg-bg-surface border border-border"
                loading="lazy"
              />
              <div className="min-w-0">
                <div className="font-semibold truncate">{method.name}</div>
                {method.note && <div className="text-xs text-text-secondary mt-0.5 line-clamp-2">{method.note}</div>}
              </div>
            </div>
          </div>

          {/* معلومات الحساب / التكوين */}
          <PaymentMethodConfigView method={method} />

          {error && <div className="mb-3 text-danger">{error}</div>}

          {/* النموذج */}
          <form onSubmit={submitDeposit} className="card p-4 space-y-4 shadow">
            {/* المبلغ + العملة */}
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="flex-1">
                <label className="block mb-1 text-sm text-text-secondary">{t('users.topup.amount.label')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="input w-full bg-bg-input border-border"
                  placeholder={t('users.topup.amount.example',{ symbol: '' })}
                />
              </div>
              <div className="sm:w-36">
                <label className="block mb-1 text-sm text-text-secondary">{t('users.topup.currency')}</label>
                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value)}
                  className="input w-full bg-bg-input border-border"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* عملة المحفظة + سعر الصرف */}
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="flex-1">
                <label className="block mb-1 text-sm text-text-secondary">{t('billing.pay.methodId')}</label>
                <input value={walletCurrency} readOnly className="input w-full bg-bg-surface-alt border-border" />
              </div>
              <div className="flex-1">
                <label className="block mb-1 text-sm text-text-secondary">{t('payments.deposits.method.pageTitle')}</label>
                <input
                  value={rateUsed ? Number(rateUsed).toFixed(2) : ''}
                  readOnly
                  className="input w-full bg-bg-surface-alt border-border"
                />
              </div>
            </div>

            {/* القيمة المتوقعة بعد التحويل */}
            <div>
              <label className="block mb-1 text-sm text-text-secondary">{t('payments.deposits.method.pageTitle')}</label>
              <input
                value={convertedAmount ? Number(convertedAmount).toFixed(2) : ''}
                readOnly
                className="input w-full bg-success/10 border-success/30 text-text-primary"
              />
            </div>

            {/* ملاحظة */}
            <div>
              <label className="block mb-1 text-sm text-text-secondary">{t('users.topup.note.label')}</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input w-full bg-bg-input border-border"
                placeholder={t('users.topup.note.placeholder')}
              />
            </div>

            {/* أزرار */}
            <div className="flex gap-3 justify-start">
              <button
                type="submit"
                className="btn btn-primary hover:bg-primary-hover"
              >
                {t('billing.pay.submit')}
              </button>
              <button
                type="button"
                onClick={() => router.push('/wallet')}
                className="btn btn-secondary"
              >
                {t('users.topup.cancel')}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

/* ======================
   عرض الحقول (config) الخاصة بوسيلة الدفع للمستخدم
   ====================== */
interface MethodWithConfig { id: string; name: string; type: PaymentMethodType; config: Record<string, unknown>; }

function PaymentMethodConfigView({ method }: { method: MethodWithConfig }) {
  const cfg = (method?.config ?? {}) as Record<string, unknown>;
  const pickString = (key: string) => {
    const value = cfg[key];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const rawEntries = Object.entries(cfg).reduce<[string, string | number][]>((acc, [key, value]) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) acc.push([key, trimmed]);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      acc.push([key, value]);
    }
    return acc;
  }, []);
  // اختيار مفاتيح معروفة بترتيب منطقي؛ ثم أي مفاتيح إضافية نصية
  const preferredOrder = [
    'bankName','bank','accountName','accountHolder','recipientName','accountNumber','iban','swift','branch','country','city','currency','walletAddress','network','phone','transferCode','note'
  ];

  const labelMap: Record<string,string> = {
    bankName: 'اسم البنك',
    bank: 'اسم البنك',
    accountName: 'اسم صاحب الحساب',
    accountHolder: 'اسم صاحب الحساب',
    recipientName: 'اسم المستلم',
    accountNumber: 'رقم الحساب',
    iban: 'IBAN',
    swift: 'SWIFT',
    branch: 'الفرع',
    country: 'الدولة',
    city: 'المدينة',
    currency: 'العملة',
    walletAddress: 'عنوان المحفظة',
    network: 'الشبكة',
    phone: 'الهاتف',
    transferCode: 'كود التحويل',
    note: 'ملاحظة'
  };

  // استخراج القيم النصية / الرقمية فقط
  // دمج الترتيب المفضل مع الباقي
  const ordered: [string,string|number][] = [];
  const used = new Set<string>();
  for (const k of preferredOrder) {
    const f = rawEntries.find(([rk]) => rk === k);
    if (f) { ordered.push(f); used.add(k); }
  }
  for (const e of rawEntries) { if (!used.has(e[0])) ordered.push(e); }

  if (!ordered.length) return null; // لا شيء لعرضه

  const bankTitle = pickString('bankName') ?? pickString('bank');

  const copyValue = async (val: string|number) => {
    try { await navigator.clipboard?.writeText(String(val)); } catch {}
  };

  return (
    <div className="card border border-border bg-bg-surface mb-4 p-4 space-y-3">
      {bankTitle && (
        <div className="text-md font-semibold mb-1 flex items-center gap-2">
          <span>اسم البنك:</span>
          <span className="text-primary/90 break-all">{bankTitle}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ordered.map(([k,v]) => {
          if (bankTitle && (k === 'bankName' || k === 'bank')) return null; // تم عرضه أعلاه
          return (
            <button
              key={k}
              type="button"
              onClick={() => copyValue(v)}
              className="group text-start rounded border border-border/70 bg-bg-surface-alt hover:border-primary/60 hover:bg-primary/5 px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-primary/30"
              title="انقر للنسخ"
            >
              <div className="text-[11px] text-text-secondary tracking-wide mb-1">{labelMap[k] || k}</div>
              <div className="font-mono text-sm break-all group-active:scale-[.99]">
                {String(v)}
              </div>
              <div className="mt-1 text-[10px] text-primary/60 opacity-0 group-hover:opacity-100 transition">نسخ</div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-warning/80 leading-relaxed mt-2">
        يرجى تنفيذ الحوالة بهذه المعلومات ثم إدخال بيانات الطلب أعلاه. قد يُرفض الطلب إذا كانت البيانات أو المبلغ غير مطابقة.
      </p>
    </div>
  );
}
