// src/app/orders/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/context/UserContext';
import api, { API_ROUTES } from '@/utils/api';
import { formatGroupsDots } from '@/utils/format';
import { useAuthRequired } from '@/hooks/useAuthRequired';

type OrderStatus = 'pending' | 'approved' | 'rejected';

interface OrderDisplay { currencyCode: string; unitPrice: number; totalPrice: number; }
interface Order {
  id: string;
  status: OrderStatus;
  createdAt: string;
  product: { name: string };
  package: { name: string };
  quantity?: number;
  userIdentifier?: string | null;
  extraField?: string | null;
  orderNo?: number;
  priceUSD?: number;
  unitPriceUSD?: number;
  display?: OrderDisplay;
}
interface OrderNote { by: 'admin' | 'system' | 'user'; text: string; at: string; }
interface OrderDetails extends Order {
  manualNote?: string | null;
  notes?: OrderNote[] | null;
  externalStatus?: string | null;
  lastMessage?: string | null;
  providerMessage?: string | null;
}

interface PageInfo { nextCursor?: string | null; hasMore?: boolean; }
interface CursorResponse { items: Order[]; pageInfo?: PageInfo; meta?: any; }
type OrdersPageResponse = Order[] | CursorResponse;

const PAGE_LIMIT = 20;

function currencySymbol(code?: string) {
  switch (code) {
    case 'USD': return '$'; case 'EUR': return '€'; case 'TRY': return '₺';
    case 'EGP': return '£'; case 'SAR': return '﷼'; case 'AED': return 'د.إ';
    case 'SYP': return 'ل.س'; default: return code || '';
  }
}

function extractProviderNote(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim(); if (!s) return null;
  if (s.includes('|')) {
    const parts = s.split('|').map(x => x.trim()).filter(Boolean);
    if (!parts.length) return null;
    const last = parts[parts.length - 1];
    if (/^(OK|ERR|ERROR|\d+)$/.test(last.toUpperCase())) return null;
    return last;
  }
  return s || null;
}

function resolvePriceView(
  order: Order,
  userCurrency: string,
  conversionRate: number
): { currencyCode: string; total: number; unit?: number } {
  // إذا كان الباك إند بالفعل يرسل display نستخدمه كما هو
  if (order.display && typeof order.display.totalPrice === 'number') {
    return {
      currencyCode: order.display.currencyCode,
      total: Number(order.display.totalPrice) || 0,
      unit: typeof order.display.unitPrice === 'number' ? Number(order.display.unitPrice) : undefined,
    };
  }
  // fallback: قيم بالدولار
  const totalUSD = Number(order.priceUSD ?? 0);
  const unitUSD = order.unitPriceUSD != null ? Number(order.unitPriceUSD) : undefined;
  if (userCurrency && userCurrency !== 'USD' && conversionRate > 0) {
    return {
      currencyCode: userCurrency,
      total: totalUSD * conversionRate,
      unit: unitUSD == null ? undefined : unitUSD * conversionRate,
    };
  }
  return { currencyCode: 'USD', total: totalUSD, unit: unitUSD };
}

const DETAILS_ENDPOINT_ENABLED = Boolean((API_ROUTES as any)?.orders?.detailsEnabled);
function buildDetailsUrls(id: string): string[] {
  if (!DETAILS_ENDPOINT_ENABLED) return [];
  const orders = (API_ROUTES as any).orders || {};
  const urls = new Set<string>();
  if (orders.byId) {
    const u = typeof orders.byId === 'function'
      ? orders.byId(id)
      : String(orders.byId).replace(/:id|\{id\}|\$id/g, id).replace(/\/$/, '');
    urls.add(u);
  }
  if (typeof orders.mine === 'string') urls.add(`${orders.mine.replace(/\/$/, '')}/${id}`);
  if (typeof orders.base === 'string') urls.add(`${orders.base.replace(/\/$/, '')}/${id}`);
  for (const alt of (orders._alts ?? [])) {
    const clean = String(alt).replace(/\/$/, '');
    urls.add(/\/me$/.test(clean) ? clean.replace(/\/me$/, `/${id}`) : `${clean}/${id}`);
  }
  return Array.from(urls);
}

// === أدوات التاريخ ===
const pad = (n: number) => String(n).padStart(2, '0');
const toLocalYMD = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function OrdersPage() {
  useAuthRequired();
  const { user } = useUser();
  const userCurrency = user?.currency || user?.currencyCode || 'USD';
  const [conversionRate, setConversionRate] = useState<number>(1);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');

  // التاريخ: مسوّدات + قيم مطبّقة
  const [dateFromDraft, setDateFromDraft] = useState('');
  const [dateToDraft, setDateToDraft] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // البحث: مسودة + مطبّق
  const [qDraft, setQDraft] = useState('');
  const [q, setQ] = useState('');

  // الاختيار + تفاصيله
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string>('');

  // pagination
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  function dayStart(dStr: string) { return new Date(`${dStr}T00:00:00`); }
  function dayEnd(dStr: string)   { return new Date(`${dStr}T23:59:59.999`); }

  // ========== جلب أوّل دفعة ==========
  useEffect(() => {
    // الافتراضي: فلترة اليوم
    const today = toLocalYMD();
    setDateFromDraft(today); setDateToDraft(today);
    setDateFrom(today);      setDateTo(today);

    const fetchOrders = async () => {
      setLoading(true); setError('');
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) { setLoading(false); setError('الرجاء تسجيل الدخول أولاً'); return; }

      const candidates = [API_ROUTES.orders.mine, ...(API_ROUTES.orders as any)._alts ?? []];
      let lastErr: any = null;
      for (const url of candidates) {
        try {
          const res = await api.get<OrdersPageResponse>(url, { params: { limit: PAGE_LIMIT } });
          if (Array.isArray(res.data)) {
            setOrders(res.data || []); setNextCursor(null); setHasMore(false);
          } else {
            const items = res.data.items ?? [];
            const page: PageInfo = res.data.pageInfo ?? {};
            setOrders(items); setNextCursor(page.nextCursor ?? null); setHasMore(Boolean(page.hasMore));
          }
          setLoading(false); return;
        } catch (e: any) {
          lastErr = e;
          const status = e?.response?.status;
          if (status === 401) { setError('انتهت الجلسة، الرجاء تسجيل الدخول مجددًا'); setLoading(false); return; }
          if (status !== 404) break;
        }
      }
      setLoading(false);
      setError('فشل في جلب الطلبات (قد يكون المسار تغيّر في الباك إند)');
      console.error('Orders fetch error:', lastErr);
    };
    fetchOrders();
  }, []);

  // جلب معدل التحويل لعملة المستخدم (مقابل 1 USD) إن لم تكن USD
  useEffect(() => {
    let cancelled = false;
    async function fetchRate() {
      try {
        if (!userCurrency || userCurrency === 'USD') { setConversionRate(1); return; }
        const res = await api.get<any[]>(API_ROUTES.currencies.base);
        const list = Array.isArray(res.data) ? res.data : [];
        // نحاول العثور على حقل يمثل العملة: code + (rate أو factor أو value)
        const row = list.find((c:any) => (c.code || c.currency || c.symbol) === userCurrency);
        if (row) {
          const rate = Number(row.rate ?? row.factor ?? row.value ?? row.usdRate ?? 0);
          if (!cancelled && rate > 0) setConversionRate(rate);
        }
      } catch (e) {
        // تجاهل بصمت؛ سنبقى على USD إن فشل
      }
    }
    fetchRate();
    return () => { cancelled = true; };
  }, [userCurrency]);

  // ========== تحميل المزيد ==========
  async function loadMore() {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true); setError('');
      const candidates = [API_ROUTES.orders.mine, ...(API_ROUTES.orders as any)._alts ?? []];
      let lastErr: any = null;
      for (const url of candidates) {
        try {
          const res = await api.get<OrdersPageResponse>(url, { params: { limit: PAGE_LIMIT, cursor: nextCursor ?? undefined } });
          if (Array.isArray(res.data)) { setHasMore(false); setLoadingMore(false); return; }
          else {
            const items = res.data.items ?? [];
            const page: PageInfo = res.data.pageInfo ?? {};
            setOrders((prev) => [...prev, ...items]);
            setNextCursor(page.nextCursor ?? null); setHasMore(Boolean(page.hasMore)); setLoadingMore(false); return;
          }
        } catch (e: any) { lastErr = e; const status = e?.response?.status; if (status !== 404) break; }
      }
      setError('فشل في تحميل المزيد.');
    } finally { setLoadingMore(false); }
  }

  const getStatusText  = (s: OrderStatus) => s === 'approved' ? 'مقبول' : s === 'rejected' ? 'مرفوض' : 'قيد المراجعة';
  const getStatusColor = (s: OrderStatus) => s === 'approved' ? 'text-success' : s === 'rejected' ? 'text-danger' : 'text-warning';
  const getStatusIcon  = (s: OrderStatus) => s === 'approved'
    ? (<span className="inline-flex w-4 h-4 rounded-full bg-success items-center justify-center"><span className="text-[10px] text-[rgb(var(--color-primary-contrast))]">✔</span></span>)
    : s === 'rejected'
      ? (<span className="inline-flex w-4 h-4 rounded-full bg-danger items-center justify-center"><span className="w-2 h-[2px] bg-[rgb(var(--color-primary-contrast))] block"/></span>)
      : (<span className="inline-block w-4 h-4 rounded-full bg-warning" />);

  // ====== الفلترة (باستخدام القيم المُطبَّقة فقط) ======
  const filteredOrders = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (filter === 'all' ? orders : orders.filter((o) => o.status === filter))
      .filter((o) => {
        if (!dateFrom && !dateTo) return true;
        const created = new Date(o.createdAt).getTime();
        if (dateFrom) { const from = dayStart(dateFrom).getTime(); if (created < from) return false; }
        if (dateTo)   { const to   = dayEnd(dateTo).getTime();     if (created > to)   return false; }
        return true;
      })
      .filter((o) => {
        if (!query) return true;
        const a = (o.userIdentifier ?? '').toString().toLowerCase();
        const b = (o.extraField ?? '').toString().toLowerCase();
        return a.includes(query) || b.includes(query);
      });
  }, [orders, filter, dateFrom, dateTo, q]);

  if (loading) return <p className="text-center mt-4 text-text-secondary">جاري التحميل...</p>;
  if (error)   return <p className="text-center text-danger mt-4">{error}</p>;

  return (
    <div className="p-4 bg-bg-base text-text-primary" dir="rtl">
      <h1 className="text-lg font-bold mb-4 text-right">📦 طلباتي</h1>

      {/* ===== أعلى: شريط الفلترة والبحث ===== */}
      <div className="mb-4 space-y-3">

          {/* صف التاريخ: من/إلى بجانب بعض + أيقونة تطبيق (مقاس صغير) */}
          <div className="flex items-center justify-center gap-2 flex-nowrap">
            {/* من */}
            <div className="flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-3 py-1.5 w-[140px] shrink-0">
              <span className="text-xs text-text-secondary">من</span>
              <input
                type="date"
                value={dateFromDraft}
                onChange={(e) => setDateFromDraft(e.target.value)}
                className="text-xs bg-transparent outline-none w-[110px]"
                style={{ minWidth: 0 }}
              />
            </div>

            {/* إلى */}
            <div className="flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-3 py-1.5 w-[140px] shrink-0">
              <span className="text-xs text-text-secondary">إلى</span>
              <input
                type="date"
                value={dateToDraft}
                onChange={(e) => setDateToDraft(e.target.value)}
                className="text-xs bg-transparent outline-none w-[110px]"
                style={{ minWidth: 0 }}
              />
            </div>

  {/* أيقونة تطبيق فلترة التاريخ */}
  <button
    onClick={() => { setDateFrom(dateFromDraft); setDateTo(dateToDraft); }}
    className="w-8 h-8 rounded-full bg-success text-[rgb(var(--color-primary-contrast))] grid place-items-center shadow shrink-0"
    title="تطبيق فلترة التاريخ"
    aria-label="تطبيق فلترة التاريخ"
  >
    🔎
  </button>
</div>


        {/* صف البحث: input + أيقونة فقط */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 py-1.5 min-w-[260px]">
            <input
              type="text"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="بحث بالمعرّف أو الحقل الإضافي"
              className="text-xs bg-transparent outline-none w-full"
              onKeyDown={(e) => { if (e.key === 'Enter') setQ(qDraft); }}
            />
          </div>
          <button
            onClick={() => setQ(qDraft)}
            className="w-9 h-9 rounded-full bg-success text-[rgb(var(--color-primary-contrast))] grid place-items-center shadow"
            title="بحث"
            aria-label="بحث"
          >
            🔍
          </button>
        </div>

        {/* صف أزرار الحالة (يأتي أسفل التاريخ والبحث) */}
        <div className="flex gap-2 flex-wrap justify-center pt-1">
          {(['all','approved','rejected','pending'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={[
                'btn text-xs',
                k==='all'      && filter==='all'      ? 'btn-primary hover:bg-primary-hover' : '',
                k==='approved' && filter==='approved' ? 'bg-success text-[rgb(var(--color-primary-contrast))]' : '',
                k==='rejected' && filter==='rejected' ? 'bg-danger  text-[rgb(var(--color-primary-contrast))]' : '',
                k==='pending'  && filter==='pending'  ? 'bg-warning text-[rgb(var(--color-primary-contrast))]' : '',
                (k!=='all' && filter!==k) || (k==='all' && filter!=='all') ? 'btn-secondary' : ''
              ].join(' ').trim()}
            >
              {k==='all' ? 'الكل' : k==='approved' ? '✅ مقبول' : k==='rejected' ? '❌ مرفوض' : '⏳ انتظار'}
            </button>
          ))}
        </div>
      </div>

      {/* ===== القائمة ===== */}
      {filteredOrders.length === 0 ? (
        <div className="text-center text-text-secondary">لا توجد طلبات بعد</div>
      ) : (
        <>
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const view = resolvePriceView(order, userCurrency, conversionRate);
              const totalText = Number(view.total).toFixed(2);
              const dt = new Date(order.createdAt);
              return (
                <div key={order.id} className="max-w-[980px] mx-auto relative card p-3 shadow text-xs flex justify-between items-center">
                  <div className="text-right">
                    <div className="text-text-secondary">رقم: {order.orderNo ?? `${order.id.slice(0, 8)}...`}</div>
                    <div className="text-text-primary text-[11px]">
                      {order.package?.name ?? order.product?.name ?? '—'}
                      {order.quantity && order.quantity > 1 ? (
                        <span className="ml-1 text-[10px] text-text-secondary">× {order.quantity}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center max-w-[140px] break-words whitespace-normal">
                    <div className="break-words break-all whitespace-normal text-text-primary">{order.userIdentifier || '—'}</div>
                    {order.extraField ? (<div className="mt-1 text-[11px] text-text-secondary break-words break-all">{order.extraField}</div>) : null}
                    <div className="text-link mt-1 font-medium">{currencySymbol(view.currencyCode)} {totalText}</div>
                  </div>

                  <div className="text-left pl-2">
                    <div className={`flex items-center gap-1 ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)} <span className="text-text-primary">{getStatusText(order.status)}</span>
                    </div>
                    <div className="text-text-secondary mt-1 text-[10px] leading-tight text-right">
                      <span className="block">{dt.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                      <span className="block">{dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <button onClick={() => setSelectedOrder(order)} className="absolute top-2 left-0 text-link hover:opacity-80 text-sm" title="عرض التفاصيل">📝</button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-center">
            {hasMore ? (
              <button onClick={loadMore} disabled={loadingMore} className="btn btn-primary text-xs disabled:opacity-60">
                {loadingMore ? 'جارِ التحميل…' : 'تحميل المزيد'}
              </button>
            ) : (<div className="py-2 text-xs text-text-secondary">لا يوجد المزيد</div>)}
          </div>
        </>
      )}

      {/* ===== نافذة التفاصيل ===== */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-full max-w-md p-6 shadow relative text-sm">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-2 left-2 text-text-secondary hover:text-danger text-lg" title="إغلاق">✖</button>
            <h2 className="text-xl mb-4 font-bold text-center">تفاصيل الطلب</h2>
            {detailsLoading ? (
              <div className="text-center py-6 text-text-secondary">جاري جلب التفاصيل…</div>
            ) : detailsError ? (
              <div className="text-center py-6 text-danger">{detailsError}</div>
            ) : (() => {
              const base = details || (selectedOrder as OrderDetails);
              const view = resolvePriceView(base, userCurrency, conversionRate);
              const totalNum = Number(view.total) || 0;
              return (
                <div className="space-y-3">
                  <p><span className="text-text-secondary">رقم الطلب:</span> {base.orderNo ?? (base.id?.slice ? `${base.id.slice(0, 8)}...` : base.id)}</p>
                  <p><span className="text-text-secondary">اسم المنتج:</span> {base.product.name}</p>
                  <p><span className="text-text-secondary">الباقة:</span> {base.package.name} {base.quantity && base.quantity > 1 ? (<span className="text-text-secondary">(الكمية: {base.quantity})</span>) : null}</p>
                  <p><span className="text-text-secondary">المعرف:</span> {base.userIdentifier || '—'}</p>
                  {base.extraField ? (<p><span className="text-text-secondary">معلومة إضافية:</span> {base.extraField}</p>) : null}
                  <p><span className="text-text-secondary">السعر:</span> <span className="text-text-primary">{currencySymbol(view.currencyCode)} {formatGroupsDots(totalNum)}</span></p>
                  <p><span className="text-text-secondary">الحالة:</span> <span className={getStatusColor(base.status)}>{getStatusText(base.status)}</span></p>
                  <p><span className="text-text-secondary">التاريخ:</span> {new Date(base.createdAt).toLocaleString('en-US')}</p>
                  {(() => {
                    const rawNote = (base as any).providerMessage ?? base.lastMessage;
                    const note = extractProviderNote(rawNote);
                    return note ? (
                      <p className="flex flex-col mt-2 bg-orange-900 px-2 py-1 rounded">
                        <span className="text-white mb-2">رسالة الملاحظة:</span>
                        <span className="text-white break-words">{note}</span>
                      </p>
                    ) : null;
                  })()}
                  {base.manualNote ? (
                    <div className="mt-3 p-2 rounded bg-[rgba(255,165,0,0.08)] border border-[rgba(255,165,0,0.25)]">
                      <div className="font-medium mb-2">📝 ملاحظة</div>
                      <div className="text-text-primary break-words whitespace-pre-wrap">{base.manualNote}</div>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
