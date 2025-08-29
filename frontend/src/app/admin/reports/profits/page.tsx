// src/app/admin/reports/profits/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api, { API_ROUTES } from '@/utils/api';

type RangePreset = 'today' | 'this_month' | 'last_month' | 'last_6_months' | 'custom';

// يدعم شكلين: الافتراضي (TRY + USD) أو usd_only (totalsUSD + profitUSD)
interface ProfitsResponseDefault {
  filters: { range: RangePreset; start: string; end: string; userId: string | null; provider: string | null; view?: string };
  counts: { total: number; approved: number; rejected: number };
  totalsTRY: { cost: number; sales: number };
  profit: { try: number; usd: number; rateTRY: number };
}
interface ProfitsResponseUsdOnly {
  filters: { range: RangePreset; start: string; end: string; userId: string | null; provider: string | null; view: 'usd_only' };
  counts: { total: number; approved: number; rejected: number };
  totalsUSD: { cost: number; sales: number };
  profitUSD: number;
  rateTRY: number;
}
type ProfitsResponse = ProfitsResponseDefault | ProfitsResponseUsdOnly;
interface Option { value: string; label: string; }

export default function AdminReportsProfitsPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProfitsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // نطاق الوقت
  const [range, setRange] = useState<RangePreset>('today');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');

  // المستخدم
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<Option[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [userLabel, setUserLabel] = useState<string>('');
  const [openUsers, setOpenUsers] = useState(false);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [userMenuPos, setUserMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // المزوّد
  const [providers, setProviders] = useState<Option[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [providerLabel, setProviderLabel] = useState<string>('');
  const [openProviders, setOpenProviders] = useState(false);
  const providerBtnRef = useRef<HTMLButtonElement | null>(null);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);
  const [providerMenuPos, setProviderMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // ============ أدوات تموضع القائمة (ثابتة، آمنة للموبايل و RTL) ============
  const VIEWPORT_PADDING = 8;
  const MIN_WIDTH_PROVIDER = 200;
  const MIN_WIDTH_USER = 260;

  /** يحسب تموضع القائمة أسفل الزر مباشرة، مع محاذاة يمين-إلى-يسار ومنع الخروج عن الشاشة */
  const computeMenuPos = (btn: HTMLButtonElement | null, minWidth: number) => {
    if (!btn) return null;
    const r = btn.getBoundingClientRect(); // قيم نسبةً للـ viewport (مناسبة لـ position:fixed)
    const vw = window.innerWidth;
    const menuWidth = Math.max(r.width, minWidth);

    // في واجهات RTL الأفضل محاذاة القائمة مع الطرف الأيمن للزر
    let preferredLeft = r.right - menuWidth;

    // منع الخروج عن الشاشة:
    const left = Math.min(
      Math.max(preferredLeft, VIEWPORT_PADDING),
      vw - menuWidth - VIEWPORT_PADDING
    );

    const top = Math.round(r.bottom + 6);

    return { top, left, width: menuWidth };
  };

  /** يفتح القائمة ويحسب تموضعها فورًا */
  const openMenuNear = (
    btn: HTMLButtonElement | null,
    setPos: (p: { top: number; left: number; width: number } | null) => void,
    setOpen: (v: boolean) => void,
    minWidth: number
  ) => {
    const pos = computeMenuPos(btn, minWidth);
    if (!pos) return;
    setPos(pos);
    setOpen(true);
  };

  // إعادة حساب التموضع عند تغيير حجم الشاشة أو التمرير بينما القائمة مفتوحة
  useEffect(() => {
    const onReposition = () => {
      if (openProviders) {
        const pos = computeMenuPos(providerBtnRef.current, MIN_WIDTH_PROVIDER);
        pos && setProviderMenuPos(pos);
      }
      if (openUsers) {
        const pos = computeMenuPos(userBtnRef.current, MIN_WIDTH_USER);
        pos && setUserMenuPos(pos);
      }
    };
    if (openProviders || openUsers) {
      window.addEventListener('resize', onReposition);
      window.addEventListener('scroll', onReposition, { passive: true });
    }
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition);
    };
  }, [openProviders, openUsers]);

  // إغلاق القوائم عند النقر خارجها — مع مراعاة عناصر الـPortal
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;

      if (openUsers) {
        const clickInsideUsersBtn = userBtnRef.current?.contains(t);
        const clickInsideUsersMenu = userMenuRef.current?.contains(t);
        if (!clickInsideUsersBtn && !clickInsideUsersMenu) setOpenUsers(false);
      }

      if (openProviders) {
        const clickInsideProvBtn = providerBtnRef.current?.contains(t);
        const clickInsideProvMenu = providerMenuRef.current?.contains(t);
        if (!clickInsideProvBtn && !clickInsideProvMenu) setOpenProviders(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openUsers, openProviders]);

  // زر تطبيق مفعل فقط عند صحة المُدخلات في النطاق المخصص
  const canApply = useMemo(() => {
    if (range !== 'custom') return true;
    return Boolean(start && end);
  }, [range, start, end]);

  // جلب البيانات (زر تطبيق)
  const fetchData = async () => {
    await fetchDataWith();
  };

  // دالة جلب عامة تسمح بتجاوزات لحظية (للتطبيق الفوري)
  const fetchDataWith = async (overrides?: Partial<{
    range: RangePreset; start: string; end: string; userId: string; provider: string;
  }>) => {
    setLoading(true);
    setError(null);
    try {
      const effRange = overrides?.range ?? range;
      const params: Record<string, string> = { range: effRange };

      const effStart = overrides?.start ?? start;
      const effEnd = overrides?.end ?? end;
      if (effRange === 'custom' && effStart && effEnd) {
        params.start = effStart; params.end = effEnd;
      }

      const effUserId = overrides?.userId ?? userId;
      const effProvider = overrides?.provider ?? provider;
      if (effUserId) params.userId = effUserId;
      if (effProvider) params.provider = effProvider;

  // نطلب دائماً العرض بالدولار فقط
  params.view = 'usd_only';
  const resp = await api.get<ProfitsResponse>(API_ROUTES.admin.reports.profits, { params });
  setData(resp.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  // أول تحميل + جلب لائحة المزوّدين
  useEffect(() => {
    fetchDataWith();
    (async () => {
      try {
        const { data } = await api.get<{ id: string; label: string }[]>(API_ROUTES.admin.reports.providers);
        const opts: Option[] = (data || []).map(v => ({ value: v.id, label: v.label }));
        setProviders(opts);
      } catch {/* تجاهل */}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // بحث المستخدمين (debounce)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<{ id: string; label: string }[]>(API_ROUTES.admin.reports.users, {
          params: { q: userSearch, limit: 20 },
        });
        setUserOptions((data || []).map(x => ({ value: x.id, label: x.label })));
      } catch {
        setUserOptions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch]);

  // أزرار الفترات
  const presets: { key: RangePreset; label: string }[] = [
    { key: 'today', label: 'اليوم' },
    { key: 'this_month', label: 'هذا الشهر' },
    { key: 'last_month', label: 'الشهر الماضي' },
    { key: 'last_6_months', label: 'آخر 6 أشهر' },
    { key: 'custom', label: 'مخصص' },
  ];

  // تنسيق رقم
  const fmtNum = (n: number | undefined | null, fd = 2) => {
    const v = Number(n ?? 0);
    if (!Number.isFinite(v)) return '0';
    return v.toLocaleString('en-US', { minimumFractionDigits: fd, maximumFractionDigits: fd });
  };

  const isUsdOnly = data && 'totalsUSD' in data;
  const costDisplay = isUsdOnly ? fmtNum((data as ProfitsResponseUsdOnly).totalsUSD.cost) : fmtNum((data as ProfitsResponseDefault|any)?.totalsTRY?.cost);
  const salesDisplay = isUsdOnly ? fmtNum((data as ProfitsResponseUsdOnly).totalsUSD.sales) : fmtNum((data as ProfitsResponseDefault|any)?.totalsTRY?.sales);
  const profitDisplay = isUsdOnly
    ? fmtNum((data as ProfitsResponseUsdOnly).profitUSD)
    : fmtNum((data as ProfitsResponseDefault|any)?.profit?.try);
  const rateTRY = isUsdOnly
    ? (data as ProfitsResponseUsdOnly).rateTRY
    : (data as ProfitsResponseDefault|any)?.profit?.rateTRY;
  const profitUsdExplicit = isUsdOnly
    ? fmtNum((data as ProfitsResponseUsdOnly).profitUSD)
    : fmtNum((data as ProfitsResponseDefault|any)?.profit?.usd);

  return (
    <div className="space-y-4 text-text-primary bg-bg-base p-2">
      <h1 className="font-bold">تقارير الأرباح</h1>

      {/* شريط الفلاتر */}
      <section className="rounded-md border border-border bg-bg-surface p-3" dir="rtl">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => { setRange(p.key); }}
              className={`px-3 py-1.5 rounded-md text-sm transition border
                ${range === p.key
                  ? 'bg-primary text-primary-contrast border-border'
                  : 'bg-bg-surface-alt text-text-primary border-border hover:opacity-90'}`}
            >
              {p.label}
            </button>
          ))}

          {range === 'custom' && (
            <>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <label className="text-sm">من:</label>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="border border-border rounded px-2 py-1 text-sm bg-bg-input text-text-primary"
                />
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <label className="text-sm">إلى:</label>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="border border-border rounded px-2 py-1 text-sm bg-bg-input text-text-primary"
                />
              </div>
            </>
          )}
        </div>

        {/* أدوات التصفية */}
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto [&>*]:shrink-0">
          {/* المزوّد */}
          <button
            ref={providerBtnRef}
            type="button"
            onClick={() => openMenuNear(providerBtnRef.current, setProviderMenuPos, setOpenProviders, MIN_WIDTH_PROVIDER)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-border bg-bg-surface-alt"
          >
            <span>المزوّد</span>
            <span className="opacity-70 whitespace-nowrap">
              {provider ? (providerLabel || providers.find(p => p.value === provider)?.label || provider) : 'الكل'}
            </span>
            <span className="opacity-60">▾</span>
          </button>

          {/* المستخدم */}
          <button
            ref={userBtnRef}
            type="button"
            onClick={() => openMenuNear(userBtnRef.current, setUserMenuPos, setOpenUsers, MIN_WIDTH_USER)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-border bg-bg-surface-alt"
          >
            <span>المستخدم</span>
            <span className="opacity-70 whitespace-nowrap">
              {userId ? (userLabel || userOptions.find(u => u.value === userId)?.label || userId) : 'الكل'}
            </span>
            <span className="opacity-60">▾</span>
          </button>

          {/* زر تطبيق */}
          <button
            onClick={fetchData}
            disabled={loading || !canApply}
            className={`px-4 py-1.5 rounded-md text-sm text-primary-contrast transition
              ${!canApply || loading ? 'bg-bg-surface-alt cursor-not-allowed text-text-secondary' : 'bg-primary hover:bg-primary-hover'}`}
          >
            {loading ? 'جاري التحميل…' : 'تطبيق'}
          </button>
        </div>
      </section>

      {/* الرسالة */}
      {error && <div className="text-danger text-sm">{error}</div>}

      {/* البطاقة */}
      <section className="inline-block max-w-full rounded-lg bg-bg-surface border border-border p-4" dir="rtl">
        <div className="grid grid-cols-[1fr,auto] gap-x-6 gap-y-2 items-start">
          <div className="text-text-secondary">إجمالي الطلبات</div>
          <div className="text-left"><span className="block text-xl font-bold">{data ? (data as any).counts.total : 0}</span></div>

          <div className="text-success">المقبولة</div>
          <div className="text-left"><span className="block text-xl font-bold">{data ? (data as any).counts.approved : 0}</span></div>

          <div className="text-danger">المرفوضة</div>
          <div className="text-left"><span className="block text-xl font-bold">{data ? (data as any).counts.rejected : 0}</span></div>

          <div className="col-span-2 my-2"><hr className="border-border" /></div>

          <div className="text-text-primary">مجموع التكلفة (USD)</div>
          <div className="text-left" dir="ltr"><span className="block text-xl font-bold">{costDisplay} USD</span></div>

          <div className="text-text-primary">مجموع سعر البيع (USD)</div>
          <div className="text-left" dir="ltr"><span className="block text-xl font-bold">{salesDisplay} USD</span></div>

          <div className="text-text-primary">الربح النهائي (USD)</div>
          <div className="text-left" dir="ltr"><span className="block text-xl font-bold">{profitDisplay} USD</span></div>

          <div className="col-span-2 text-left text-xs text-text-secondary" dir="ltr">
            (سعر الصرف الحالي: 1 USD = {rateTRY ?? '—'} TRY)
          </div>
        </div>

      </section>

      {/* قوائم الـPortal لمنع القصّ */}
      {openProviders && providerMenuPos && createPortal(
        <div
          ref={providerMenuRef}
          style={{
            position: 'fixed',
            top: providerMenuPos.top,
            left: providerMenuPos.left,
            width: providerMenuPos.width,
            zIndex: 1000
          }}
          className="max-h-64 overflow-auto rounded-md border border-border bg-bg-surface shadow-lg"
        >
          <button
            onClick={() => { setProvider(''); setProviderLabel(''); setOpenProviders(false); fetchDataWith({ provider: '' }); }}
            className={`w-full text-right px-3 py-2 text-sm ${!provider ? 'bg-bg-surface-alt' : 'hover:bg-bg-surface-alt'}`}
          >
            الكل (بدون تصفية)
          </button>
          {providers.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                setProvider(opt.value); setProviderLabel(opt.label); setOpenProviders(false);
                fetchDataWith({ provider: opt.value }); // تطبيق فوري
              }}
              className={`w-full text-right px-3 py-2 text-sm ${provider === opt.value ? 'bg-primary/20' : 'hover:bg-bg-surface-alt'}`}
              title={opt.label}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}

      {openUsers && userMenuPos && createPortal(
        <div
          ref={userMenuRef}
          style={{
            position: 'fixed',
            top: userMenuPos.top,
            left: userMenuPos.left,
            width: userMenuPos.width,
            zIndex: 1000
          }}
          className="rounded-md border border-border bg-bg-surface shadow-lg"
        >
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الإيميل…"
              className="w-full border border-border rounded px-2 py-1 text-sm bg-bg-input text-text-primary"
            />
          </div>
          <div className="max-h-56 overflow-auto">
            <button
              onClick={() => { setUserId(''); setUserLabel(''); setOpenUsers(false); fetchDataWith({ userId: '' }); }}
              className={`w-full text-right px-3 py-2 text-sm ${!userId ? 'bg-bg-surface-alt' : 'hover:bg-bg-surface-alt'}`}
            >
              الكل (بدون تصفية)
            </button>
            {userOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  setUserId(opt.value); setUserLabel(opt.label); setOpenUsers(false);
                  fetchDataWith({ userId: opt.value }); // تطبيق فوري
                }}
                className={`w-full text-right px-3 py-2 text-sm ${userId === opt.value ? 'bg-primary/20' : 'hover:bg-bg-surface-alt'}`}
                title={opt.label}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
