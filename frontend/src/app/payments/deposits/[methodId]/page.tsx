// src/app/payments/deposits/[methodId]/page.tsx  ← عدّل المسار حسب مشروعك
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api, { API_ROUTES, API_BASE_URL } from '@/utils/api';

type PaymentMethodType = 'CASH_BOX' | 'BANK_ACCOUNT' | 'HAND_DELIVERY' | 'USDT' | 'MONEY_TRANSFER';

interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  logoUrl?: string | null;
  note?: string | null;
  isActive: boolean;
  config: Record<string, any>;
}

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

const FILES_BASE = API_BASE_URL.replace(/\/api$/, '');
const fileUrl = (u?: string | null) => (!u ? '' : u.startsWith('/uploads') ? `${FILES_BASE}${u}` : u);
const valueOf = (c: CurrencyRow): number => {
  const n = Number(c.rate ?? c.value ?? c.price ?? 0);
  return isFinite(n) && n > 0 ? n : 0;
};

export default function DepositCreatePage() {
  const { methodId } = useParams<{ methodId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [profile, setProfile] = useState<ProfileWithCurrency | null>(null);

  const [amount, setAmount] = useState<string>('');             // المبلغ المُرسل
  const [fromCurrency, setFromCurrency] = useState<string>(''); // العملة المُرسلة
  const [note, setNote] = useState<string>('');                 // ملاحظة اختيارية

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
      const methodsRes = await api.get<PaymentMethod[]>(API_ROUTES.payments.methods.active);
      const allMethods = Array.isArray(methodsRes.data) ? methodsRes.data : [];
      const current = allMethods.find((m) => m.id === methodId) || null;
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
      const msg = e?.response?.data?.message || e?.message || 'تعذّر التحميل.';
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
      if (!method) throw new Error('لم يتم العثور على وسيلة الدفع المحددة.');
      const a = Number(amount);
      if (!a || a <= 0) throw new Error('يرجى إدخال مبلغ صحيح.');

      await api.post(API_ROUTES.payments.deposits.create, {
        methodId: method.id,
        originalAmount: a,
        originalCurrency: fromCurrency,
        walletCurrency,
        note: note || undefined,
      });

      alert('تم إرسال طلب الإيداع بنجاح! سيقوم فريقنا بمراجعته.');
      router.push('/wallet');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'تعذّر إرسال الطلب.';
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
        ← رجوع
      </button>

      <h1 className="text-lg sm:text-xl font-bold mb-2">إنشاء طلب إيداع</h1>

      {loading ? (
        <div className="text-text-secondary">جارِ التحميل...</div>
      ) : !method ? (
        <div className="text-danger">لم يتم العثور على وسيلة الدفع.</div>
      ) : (
        <>
          {/* بطاقة وسيلة الدفع */}
          <div className="rounded-xl border border-border bg-subnav text-text-primary p-3 mb-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {method.logoUrl ? (
                <img
                  src={fileUrl(method.logoUrl)}
                  alt={method.name}
                  className="w-12 h-12 object-contain rounded bg-bg-surface border border-border"
                  loading="lazy"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-bg-surface border border-border grid place-items-center text-text-secondary">
                  —
                </div>
              )}
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
                <label className="block mb-1 text-sm text-text-secondary">المبلغ</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="input w-full bg-bg-input border-border"
                  placeholder="مثال: 100"
                />
              </div>
              <div className="sm:w-36">
                <label className="block mb-1 text-sm text-text-secondary">العملة</label>
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
                <label className="block mb-1 text-sm text-text-secondary">عملة محفظتك</label>
                <input value={walletCurrency} readOnly className="input w-full bg-bg-surface-alt border-border" />
              </div>
              <div className="flex-1">
                <label className="block mb-1 text-sm text-text-secondary">سعر الصرف</label>
                <input
                  value={rateUsed ? Number(rateUsed).toFixed(4) : ''}
                  readOnly
                  className="input w-full bg-bg-surface-alt border-border"
                />
              </div>
            </div>

            {/* القيمة المتوقعة بعد التحويل */}
            <div>
              <label className="block mb-1 text-sm text-text-secondary">القيمة التي ستُضاف لمحفظتك</label>
              <input
                value={convertedAmount ? Number(convertedAmount).toFixed(2) : ''}
                readOnly
                className="input w-full bg-success/10 border-success/30 text-text-primary"
              />
            </div>

            {/* ملاحظة */}
            <div>
              <label className="block mb-1 text-sm text-text-secondary">ملاحظة (اختياري)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input w-full bg-bg-input border-border"
                placeholder="مثال: رقم الحوالة / تفاصيل إضافية"
              />
            </div>

            {/* أزرار */}
            <div className="flex gap-3 justify-start">
              <button
                type="submit"
                className="btn btn-primary hover:bg-primary-hover"
              >
                طلب
              </button>
              <button
                type="button"
                onClick={() => router.push('/wallet')}
                className="btn btn-secondary"
              >
                إلغاء
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
interface MethodWithConfig { id: string; name: string; type: PaymentMethodType; config: Record<string, any>; }

function PaymentMethodConfigView({ method }: { method: MethodWithConfig }) {
  const cfg = method?.config || {};
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
  const rawEntries = Object.entries(cfg).filter(([_,v]) => ['string','number'].includes(typeof v) && String(v).trim() !== '');

  // دمج الترتيب المفضل مع الباقي
  const ordered: [string,string|number][] = [];
  const used = new Set<string>();
  for (const k of preferredOrder) {
    const f = rawEntries.find(([rk]) => rk === k);
    if (f) { ordered.push(f as [string,string|number]); used.add(k); }
  }
  for (const e of rawEntries) { if (!used.has(e[0])) ordered.push(e as [string,string|number]); }

  if (!ordered.length) return null; // لا شيء لعرضه

  const bankTitle = (cfg.bankName || cfg.bank) ? (cfg.bankName || cfg.bank) : null;

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
