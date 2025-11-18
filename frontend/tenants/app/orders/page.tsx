'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { API_ROUTES, API_BASE_URL } from '@/utils/api';
import { useToast } from '@/context/ToastContext';
import { createPortal } from 'react-dom';
import { fmtDateStable } from '@/lib/fmtDateStable';

type OrderStatus = 'pending' | 'approved' | 'rejected';
type FilterMethod = '' | 'manual' | string;

/* ============== صور موحّدة (من منتجات) ============== */
const apiOriginFromBase = API_BASE_URL.replace(/\/api(?:-dj)?\/?$/, '');
const fallbackApiOrigin = API_ROUTES.products.base.replace(/\/(?:api(?:-dj)?\/)?products\/?$/, '');
const apiHost = apiOriginFromBase || fallbackApiOrigin;
// Resolve images via the same origin as the API so logos work with both NestJS and Django backends
const imageHost = apiOriginFromBase || fallbackApiOrigin || apiHost;

// توحيد منطق بناء رابط الصورة (يحاكي صفحة تفاصيل المنتج)
function resolveImage(raw?: string | null): string {
  if (!raw) return '/images/placeholder.png';
  const s = String(raw).trim();
  if (!s) return '/images/placeholder.png';
  // مطلق
  if (/^https?:\/\//i.test(s)) return s;
  // مسار يبدأ بـ /media أو /uploads - استخدم NestJS backend
  if (s.startsWith('/media') || s.startsWith('/uploads')) {
    return `${imageHost}${s}`;
  }
  // مسار يبدأ بـ /images نربطه بأصل الصفحة الحالي
  if (s.startsWith('/')) {
    if (typeof window !== 'undefined') return `${window.location.origin}${s}`;
    return `${apiHost}${s}`; // fallback أثناء SSR
  }
  // مسار نسبي – افترض أنه على الـ API host
  return `${apiHost}/${s}`;
}

function getOrderImageSrc(o: any): string {
  const raw =
    pickImageField(o.package) ??
    pickImageField(o.product);
  return buildImageSrc(raw);  
}

function pickImageField(p?: any): string | null {
  if (!p) return null;
  return p.image ?? p.imageUrl ?? p.logoUrl ?? p.iconUrl ?? p.icon ?? null;
}

function buildImageSrc(raw?: string | null): string { return resolveImage(raw); }

function getImageSrc(p?: any): string {
  return buildImageSrc(pickImageField(p));
}

function extractProviderNote(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.includes('|')) {
    const parts = s.split('|').map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return null;
    const last = parts[parts.length - 1];
    if (/^(OK|ERR|ERROR|\d+)$/.test(last.toUpperCase())) return null;
    return last;
  }
  return s;
}

type OrdersPageResponse = {
  items: any[];
  pageInfo: { nextCursor: string | null; hasMore: boolean };
  meta?: any;
};

/* ============== صور المنتجات ============== */
const API_ORIGIN = API_BASE_URL.replace(/\/api(?:-dj)?\/?$/, '');
const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="40">
      <rect width="100%" height="100%" fill="#e5e7eb"/>
    </svg>`
  );

function normalizeImageUrl(u?: string | null): string | null {
  if (!u) return null;
  const s = String(u).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return `${API_ORIGIN}${s}`;
  return `${API_ORIGIN}/${s}`;
}

const normalizeChainPathPayload = (value: any): ChainPath | null => {
  if (value === undefined || value === null) return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const rawText = typeof value.raw === 'string' ? value.raw : '';
    const nodes = Array.isArray(value.nodes)
      ? value.nodes.map((node: any) => String(node)).filter(Boolean)
      : [];
    const raw = rawText || (nodes.length ? nodes.join(' → ') : '');
    return { raw, nodes };
  }

  if (Array.isArray(value)) {
    const nodes = value.map((node) => String(node)).filter(Boolean);
    return { raw: nodes.join(' → '), nodes };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      const normalized = normalizeChainPathPayload(parsed);
      if (normalized) return normalized;
    } catch (err) {
      // ignore json errors and treat as plain string
    }
    const nodes = trimmed.includes('>')
      ? trimmed.split('>').map((node) => node.trim()).filter(Boolean)
      : [trimmed];
    return { raw: trimmed, nodes };
  }

  const asString = String(value);
  return { raw: asString, nodes: [asString] };
};

type ProductImagePayload = {
  imageUrl?: string;
  logoUrl?: string;
  iconUrl?: string;
  icon?: string;
  image?: string;
};

interface ProductMini { id?: string; name?: string; imageUrl?: string | null; }
interface ProductPackage { id: string; name: string; imageUrl?: string | null; productId?: string | null; }
interface Provider { id: string; name: string; }

const CODES_PROVIDER_ID = '__CODES__';

type ChainPath = { raw: string; nodes: string[] };
type FeatureFlags = {
  adminReroute?: boolean;
  chainStatusPropagation?: boolean;
  usdCostEnforcement?: boolean;
  autoFallbackRouting?: boolean;
};

interface OrderAuditRow {
  id: number;
  orderId: string;
  action: string;
  result?: string | null;
  message?: string | null;
  createdAt?: string | null;
  payload?: any;
}

interface Order {
  id: string;
  orderNo?: number | null;
  username?: string;
  userEmail?: string;
  providerType?: 'manual' | 'external' | 'internal_codes'

  // ✅ الحقول التي نعرضها في المودال
  manualNote?: string | null;
  providerMessage?: string | null;
  pinCode?: string | null;
  notesCount?: number;

  product?: ProductMini & {
    image?: string | null;
    logoUrl?: string | null;
    iconUrl?: string | null;
    icon?: string | null;
  };
  package?: ProductPackage & {
    image?: string | null;
    logoUrl?: string | null;
    iconUrl?: string | null;
    icon?: string | null;
  };

  fxLocked?: boolean;
  approvedLocalDate?: string;

  // قيم السيرفر الأساسية (قد لا نستخدمها مباشرة في الجدول)
  costAmount?: number;
  manualCost?: number; 
  quantity?: number;
  sellPriceAmount?: number;
  price?: number;
  sellPriceCurrency?: string;
  costCurrency?: string;
  currencyCode?: string;

  // ما يعرضه الجدول
  costTRY?: number;
  sellTRY?: number;
  profitTRY?: number;
  currencyTRY?: string;
  fxUsdTryAtOrder?: number | null;
  fxUsdTryAtApproval?: number | null;

  // 🔒 لقطات USD عند إنشاء الطلب
  sellUsdAtOrder?: number;
  costUsdAtOrder?: number | null;
  profitUsdAtOrder?: number | null;

  providerId?: string | null;
  providerName?: string | null;
  externalOrderId?: string | null;

  rootOrderId?: string | null;
  chainPath?: ChainPath | null;
  mode?: string | null;
  costSource?: string | null;
  costPriceUsd?: number | null;
  costTryCurrent?: number | null;
  hasFallbackNote?: boolean;

  status: OrderStatus;
  userIdentifier?: string | null;
  extraField?: string | null;

  createdAt: string;
  sentAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;

  productId?: string | null;
}

// تطبيع القيم المالية (USD / TRY) لضمان أن الربح بالليرة = فرق البيع والشراء بالليرة
function normalizeFinancial(o: any) {
  const toNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const fxCandidate = o.fxUsdTryAtOrder ?? o.fxUsdTryAtApproval;
  const fx = toNumber(fxCandidate);
  let fxRate = fx && fx > 0 ? fx : null;

  const quantity = Number(o.quantity ?? 1) || 1;

  let costUSD = toNumber(o.costUsdAtOrder);
  if (costUSD == null && o.costCurrency === 'USD' && o.costAmount != null) {
    costUSD = toNumber(o.costAmount);
  }
  if (costUSD == null && o.costPriceUsd != null) {
    let perUnit = toNumber(o.costPriceUsd);
    if (perUnit != null) {
      // Fix old manual orders: if value > 10 and we have FX rate, it's likely TRY stored as USD
      if ((o.mode === 'MANUAL' || o.mode === 'manual') && perUnit > 10 && fxRate && fxRate > 30) {
        perUnit = perUnit / fxRate;
      }
      costUSD = perUnit * quantity;
    }
  }
  
  // ENHANCED MANUAL COST DISPLAY: For manual orders, ensure cost is displayed
  if (costUSD == null && (o.mode === 'MANUAL' || o.mode === 'manual') && o.costPriceUsd != null) {
    const manualCost = toNumber(o.costPriceUsd);
    if (manualCost != null) {
      costUSD = manualCost * quantity;
    }
  }

  let costTRY = toNumber(o.costTRY);
  if (costTRY == null && o.costCurrency === 'TRY' && o.costAmount != null) {
    costTRY = toNumber(o.costAmount);
  }
  if (costTRY == null && o.costTryCurrent != null) {
    costTRY = toNumber(o.costTryCurrent);
  }

  if (!fxRate && costTRY != null && costUSD != null && costUSD !== 0) {
    fxRate = costTRY / costUSD;
  }

  // Calculate conversions
  // For manual orders: if costUSD still null but we have TRY, convert it
  if (costUSD == null && costTRY != null && fxRate) {
    costUSD = costTRY / fxRate;
  }
  // Don't calculate TRY from USD for manual orders (we only care about USD display)
  if (costTRY == null && costUSD != null && fxRate && o.mode !== 'MANUAL' && o.mode !== 'manual') {
    costTRY = costUSD * fxRate;
  }

  let sellUSD = toNumber(o.sellUsdAtOrder);
  let sellTRY = toNumber(o.sellTRY);

  if (sellTRY == null && o.sellPriceAmount != null && o.sellPriceCurrency === 'TRY') {
    sellTRY = toNumber(o.sellPriceAmount);
  }
  if (sellUSD == null && o.sellPriceAmount != null && o.sellPriceCurrency === 'USD') {
    sellUSD = toNumber(o.sellPriceAmount);
  }
  if (sellUSD == null && o.price != null) {
    sellUSD = toNumber(o.price);
  }

  if (sellTRY == null && sellUSD != null && fxRate) {
    sellTRY = sellUSD * fxRate;
  }
  if (sellUSD == null && sellTRY != null && fxRate) {
    sellUSD = sellTRY / fxRate;
  }

  if (sellUSD == null && sellTRY != null && fxRate) {
    sellUSD = sellTRY / fxRate;
  }
  if (sellTRY == null && sellUSD != null && fxRate) {
    sellTRY = sellUSD * fxRate;
  }

  let profitUSD = toNumber(o.profitUsdAtOrder);
  let profitTRY = toNumber(o.profitTRY);

  if (profitUSD == null && sellUSD != null && costUSD != null) {
    profitUSD = sellUSD - costUSD;
  }
  if (profitTRY == null && sellTRY != null && costTRY != null) {
    profitTRY = sellTRY - costTRY;
  }
  if (profitUSD == null && profitTRY != null && fxRate) {
    profitUSD = profitTRY / fxRate;
  }
  if (profitTRY == null && profitUSD != null && fxRate) {
    profitTRY = profitUSD * fxRate;
  }

  return { costUSD, sellUSD, costTRY, sellTRY, profitUSD, profitTRY };
}

interface Filters {
  q: string;
  status: '' | OrderStatus;
  method: FilterMethod; // '' | 'manual' | providerId
  from: string;
  to: string;
}

function StatusDot({
  status,
  onClick,
}: {
  status: 'pending' | 'approved' | 'rejected';
  onClick?: () => void;
}) {
  const styleMap: Record<typeof status, React.CSSProperties> = {
    approved: {
      background:
        'radial-gradient(circle at 35% 35%, #ffffff 0 5%, #9BE7A6 26% 55%, #22C55E 56% 100%)',
      boxShadow: 'inset 0 0 0 1px #6AAC5B, 0 0 0 1px #6AAC5B',
    },
    rejected: {
      background:
        'radial-gradient(circle at 35% 35%, #ffffff 0 5%, #F7A6A6 26% 55%, #EF4444 56% 100%)',
      boxShadow: 'inset 0 0 0 1px #C53333, 0 0 0 1px #C53333',
    },
    pending: {
      background:
        'radial-gradient(circle at 35% 35%, #ffffff 0 5%, #EAFF72 26% 55%, #FFF700 56% 100%)',
      boxShadow: 'inset 0 0 0 1px #D6FF6F, 0 0 0 1px #C7CB00',
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full focus:outline-none"
      title={status === 'approved' ? 'مقبول' : status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
      style={styleMap[status]}
    />
  );
}

/* ============== أدوات مساعدة ============== */
function money(n?: number, c?: string) {
  if (n === undefined || n === null) return '-';
  // استبدال TRY بالرمز المحلي TL في العرض فقط
  const code = c === 'TRY' ? 'TL' : c;
  return `${Number(n).toFixed(2)} ${code ?? ''}`.trim();
}
function fmtHMS(totalMs: number) {
  const ms = Math.max(0, totalMs);
  const sec = Math.floor(ms / 1000);
  const s = sec % 60;
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  if (h) return `${h}س ${m}د ${s}ث`;
  if (m) return `${m}د ${s}ث`;
  return `${s}ث`;
}

/* ============== مودال عبر Portal ============== */
function Modal({
  open,
  onClose,
  children,
  title,
  className,
  contentClassName,
  lockScroll = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  contentClassName?: string;
  lockScroll?: boolean;
}) {
  useEffect(() => {
    if (!open || !lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, lockScroll]);

  if (!open) return null;

  const node = (
    <div className="fixed inset-0 z-[9999]">
      {/* الخلفية */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* الغلاف الوسطي */}
      <div className={["relative flex items-center justify-center p-2 sm:p-4", className || ""].join(" ")}>
        {/* صندوق النافذة */}
        <div
          className={[
            "w-full max-w-2xl max-h-[85dvh] bg-bg-surface text-text-primary",
            "border border-border rounded-xl shadow-lg flex flex-col",
            contentClassName || ""
          ].join(" ")}
          role="dialog"
          aria-modal="true"
        >
          <div className="sticky top-0 z-10 px-4 py-3 border-b border-border bg-bg-surface/90 backdrop-blur flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title ?? 'التفاصيل'}</h3>
            <button onClick={onClose} className="text-text-secondary hover:opacity-80 rounded px-2 py-1" aria-label="إغلاق">✕</button>
          </div>

          <div className="p-4 overflow-y-auto">{children}</div>

          <div className="sticky bottom-0 z-10 px-4 py-3 border-t border-border bg-bg-surface/90 backdrop-blur flex justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded bg-bg-surface-alt hover:opacity-90 border border-border">إغلاق</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ارسم خارج الشجرة الحالية مباشرة داخل body
  return createPortal(node, document.body);
}


/* ============== الصفحة ============== */
export default function AdminOrdersPage() {
  const { show } = useToast();
  const { t } = useTranslation();
  const [logos, setLogos] = useState<Record<string, string>>({});

  const productIdOf = (o: Order): string | null => {
    return (
      (o.product?.id ?? null) ||
      (o.productId ?? null) ||
      (o.package?.productId ?? null)
    ) ?? null;
  };

  const logoUrlOf = (o: Order): string | null => {
    const directRaw =
      (o as any).product?.imageUrl ||
      (o as any).product?.image ||
      (o as any).product?.logoUrl ||
      (o as any).product?.iconUrl ||
      (o as any).product?.icon ||
      (o as any).package?.imageUrl ||
      (o as any).package?.image ||
      (o as any).package?.logoUrl ||
      (o as any).package?.iconUrl ||
      (o as any).package?.icon ||
      null;

    if (directRaw) {
      const u = normalizeImageUrl(directRaw);
      if (u) return u;
    }

    const pid = productIdOf(o);
    if (pid && logos[pid]) {
      const u = normalizeImageUrl(logos[pid]);
      if (u) return u;
    }
    return null;
  };

  const primeProductLogos = async (ordersList: Order[]) => {
    const ids = new Set<string>();
    for (const o of ordersList) {
      const hasDirectImage =
        (o as any).product?.imageUrl ||
        (o as any).product?.image ||
        (o as any).package?.imageUrl ||
        (o as any).package?.image;

      const pid = productIdOf(o);
      if (pid && !hasDirectImage && !logos[pid]) ids.add(pid);
    }
    if (ids.size === 0) return;

    const entries: [string, string][] = [];

    await Promise.all(
      [...ids].map(async (pid) => {
        try {
          let data: ProductImagePayload | null = null;
          try {
            const res = await api.get<ProductImagePayload>(API_ROUTES.products.byId(pid));
            data = (res.data ?? null) as any;
          } catch {
            const fallbackUrl = `${API_BASE_URL.replace(/\/$/, '')}/products/${pid}`;
            const res2 = await api.get<ProductImagePayload>(fallbackUrl);
            data = (res2.data ?? null) as any;
          }

          const raw =
            data?.imageUrl ||
            data?.logoUrl ||
            data?.iconUrl ||
            data?.icon ||
            data?.image ||
            '';
          const url = normalizeImageUrl(raw);
          if (url) entries.push([pid, url]);
        } catch {
          // تجاهل
        }
      })
    );

    if (entries.length) {
      setLogos((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) next[id] = url!;
        return next;
      });
    }
  };

  const [orders, setOrders] = useState<Order[]>(() => [
    {
      id: 'dummy-order-1',
      orderNo: 1001,
      username: 'ahmad123',
      userEmail: 'ahmad@example.com',
      providerType: 'external',
      product: {
        id: 'prod-1',
        name: 'PUBG',
        imageUrl: null,
      },
      package: {
        id: 'pkg-1',
        name: 'PUBG 60 UC',
        imageUrl: null,
        productId: 'prod-1',
      },
      quantity: 1,
      sellUsdAtOrder: 5.99,
      costUsdAtOrder: 5.50,
      profitUsdAtOrder: 0.49,
      fxUsdTryAtOrder: 41.5,
      sellPriceAmount: 5.99,
      sellPriceCurrency: 'USD',
      status: 'approved',
      providerId: 'provider-a',
      providerName: 'Provider A',
      externalOrderId: 'EXT-001-ABC',
      userIdentifier: '12345678',
      extraField: 'Server: EU',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date(Date.now() - 1800000).toISOString(),
      durationMs: 1800000,
    },
    {
      id: 'dummy-order-2',
      orderNo: 1002,
      username: 'sarah99',
      userEmail: 'sarah@example.com',
      providerType: 'manual',
      product: {
        id: 'prod-2',
        name: 'Free Fire',
        imageUrl: null,
      },
      package: {
        id: 'pkg-2',
        name: 'Free Fire 100 Diamonds',
        imageUrl: null,
        productId: 'prod-2',
      },
      quantity: 1,
      sellUsdAtOrder: 3.99,
      costUsdAtOrder: 3.50,
      profitUsdAtOrder: 0.49,
      fxUsdTryAtOrder: 41.5,
      sellPriceAmount: 3.99,
      sellPriceCurrency: 'USD',
      status: 'pending',
      providerId: null,
      providerName: null,
      externalOrderId: null,
      userIdentifier: '87654321',
      extraField: null,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      completedAt: null,
      durationMs: null,
    },
    {
      id: 'dummy-order-3',
      orderNo: 1003,
      username: 'khalid77',
      userEmail: 'khalid@example.com',
      providerType: 'external',
      product: {
        id: 'prod-1',
        name: 'PUBG',
        imageUrl: null,
      },
      package: {
        id: 'pkg-3',
        name: 'PUBG 325 UC',
        imageUrl: null,
        productId: 'prod-1',
      },
      quantity: 1,
      sellUsdAtOrder: 19.99,
      costUsdAtOrder: 18.50,
      profitUsdAtOrder: 1.49,
      fxUsdTryAtOrder: 41.5,
      sellPriceAmount: 19.99,
      sellPriceCurrency: 'USD',
      status: 'approved',
      providerId: 'provider-b',
      providerName: 'Provider B',
      externalOrderId: 'EXT-002-XYZ',
      userIdentifier: '55667788',
      extraField: 'Server: ASIA',
      createdAt: new Date(Date.now() - 10800000).toISOString(),
      completedAt: new Date(Date.now() - 9000000).toISOString(),
      durationMs: 1800000,
    },
  ]);
  const [providers, setProviders] = useState<Provider[]>([
    { id: 'provider-a', name: 'Provider A' },
    { id: 'provider-b', name: 'Provider B' },
  ]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(true);

  const [filters, setFilters] = useState<Filters>({
    q: '',
    status: '',
    method: '',
    from: '',
    to: '',
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [providerId, setProviderId] = useState<string>('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const [, forceTick] = useState(0);
  const tickRef = useRef<number | null>(null);

  // 🔹 مؤشّر الباجينيشن
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // 🔹 تجهيز باراميترات الاستعلام
  const buildQueryParams = () => {
    const p: Record<string, any> = {};
    if (filters.q?.trim()) p.q = filters.q.trim();
    if (filters.status)     p.status = filters.status;
    if (filters.method)     p.method = filters.method;
    if (filters.from)       p.from = filters.from;
    if (filters.to)         p.to   = filters.to;
    p.limit = 25;
    return p;
  };

  // ===== Helpers للالتقاط العميق للحقول (meta/details/extra/provider/external) =====
  const deepFirst = <T = any>(obj: any, ...keys: string[]): T | undefined => {
    const pools = [obj, obj?.meta, obj?.details, obj?.detail, obj?.extra, obj?.provider, obj?.external];
    for (const source of pools) {
      if (!source) continue;
      for (const k of keys) {
        const v = source?.[k];
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        return v as T;
      }
    }
    return undefined;
  };

  // 🔧 يحوّل أي عنصر قادم من السيرفر إلى شكل Order الذي تعتمد عليه الواجهة
  function normalizeServerOrder(x: any): Order {
    const firstOf = <T = any>(o: any, ...keys: string[]): T | undefined => {
      if (!o) return undefined;
      for (const k of keys) {
        const v = o?.[k];
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        return v as T;
      }
      return undefined;
    };

    const userObj     = x?.user     || x?.account || null;
    const productObj  = x?.product  || x?.prod    || null;
    const packageObj  = x?.package  || x?.pkg     || null;
    const providerObj = x?.provider || null;

    // أرقام TRY إن أرسلها السيرفر
    const costTRY   = firstOf<number>(x, 'costTRY', 'cost_try');
    const sellTRY   = firstOf<number>(x, 'sellTRY', 'sell_try');
    const profitTRY = firstOf<number>(x, 'profitTRY', 'profit_try');
    const currencyTRY =
      firstOf<string>(x, 'currencyTRY', 'currency_try') ??
      (costTRY != null || sellTRY != null || profitTRY != null ? 'TRY' : undefined);

    // سعر المبيع للمستخدم
    const sellPriceAmount = firstOf<number>(x, 'sellPriceAmount', 'sell_price_amount', 'price');
    const sellPriceCurrency = firstOf<string>(
      x,
      'sellPriceCurrency',
      'sell_price_currency',
      'currencyCode',
      'currency_code'
    );

    // المعرّف والتواريخ
    const id = String(firstOf(x, 'id', 'orderId', 'order_id') ?? '');
    const createdRaw = firstOf<any>(x, 'createdAt', 'created_at');
    const createdAt =
      typeof createdRaw === 'string'
        ? createdRaw
        : createdRaw instanceof Date
        ? createdRaw.toISOString()
        : new Date().toISOString();

    // الحالة الداخلية
    const rawStatus = (firstOf<string>(x, 'status', 'orderStatus') || '').toLowerCase();
    const status: OrderStatus =
      rawStatus === 'approved' ? 'approved'
      : rawStatus === 'rejected' ? 'rejected'
      : 'pending';

    // المنتج
    const product: Order['product'] = productObj
      ? {
          id: firstOf<string>(productObj, 'id') ?? undefined,
          name: firstOf<string>(productObj, 'name') ?? undefined,
          imageUrl:
            firstOf<string>(productObj, 'imageUrl', 'image', 'logoUrl', 'iconUrl', 'icon') ??
            null,
        }
      : undefined;

    // الباقة
    let pkg: Order['package'] = undefined;
    if (packageObj) {
      const pkgId = firstOf<string>(packageObj, 'id');
      if (pkgId) {
        pkg = {
          id: pkgId,
          name: firstOf<string>(packageObj, 'name') ?? '',
          imageUrl:
            firstOf<string>(packageObj, 'imageUrl', 'image', 'logoUrl', 'iconUrl', 'icon') ??
            null,
          productId: firstOf<string>(packageObj, 'productId') ?? null,
        };
      }
    }

    // تواريخ أخرى
    const sentRaw = firstOf<any>(x, 'sentAt');
    const sentAt =
      sentRaw == null ? null
      : typeof sentRaw === 'string' ? sentRaw
      : sentRaw instanceof Date ? sentRaw.toISOString()
      : null;

    const completedRaw = firstOf<any>(x, 'completedAt');
    const completedAt =
      completedRaw == null ? null
      : typeof completedRaw === 'string' ? completedRaw
      : completedRaw instanceof Date ? completedRaw.toISOString()
      : null;

    const durationMs = firstOf<number>(x, 'durationMs') ?? null;

    // المستخدم
    const username: string | undefined =
      firstOf<string>(x, 'username', 'user_name') ??
      firstOf<string>(userObj, 'username', 'name', 'fullName', 'displayName') ??
      undefined;

    const userEmail: string | undefined =
      firstOf<string>(x, 'userEmail', 'email') ??
      firstOf<string>(userObj, 'email', 'mail', 'emailAddress') ??
      undefined;

    // ✅ إضافات: ملاحظات + PIN / عدد الملاحظات
    const manualNote =
      deepFirst<string>(
        x,
        'manualNote',
        'manual_note',
        'note_admin',
        'note_manual',
        'note'
      ) ?? null;

    const providerMessage =
      deepFirst<string>(
        x,
        'providerMessage',
        'lastMessage',
        'last_message',
        'provider_note',
        'message'
      ) ?? null;

    const pinCode =
      deepFirst<string>(x, 'pinCode', 'pin_code', 'pincode', 'pin') ?? null;

    const notesCountRaw =
      deepFirst<number>(x, 'notesCount', 'notes_count');
    const notesCount = notesCountRaw != null ? Number(notesCountRaw) : undefined;

    // المزوّد
    const providerId   = firstOf<string>(x, 'providerId') ?? null;
    const providerName =
      firstOf<string>(x, 'providerName') ??
      firstOf<string>(providerObj, 'name') ??
      null;

    const externalOrderId = firstOf<string>(x, 'externalOrderId') ?? null;

    const rootOrderId = firstOf<string>(x, 'rootOrderId', 'root_order_id') ?? null;
    const mode = firstOf<string>(x, 'mode') ?? null;
    const costSource = firstOf<string>(x, 'costSource', 'cost_source') ?? null;
    const costPriceUsdRaw = firstOf<number>(x, 'costPriceUsd', 'cost_price_usd');
    const costTryCurrentRaw = firstOf<number>(x, 'costTryCurrent', 'cost_try_current');
    const chainRaw = firstOf<any>(x, 'chainPath', 'chain_path');
    const chainPath = normalizeChainPathPayload(chainRaw);

    const notesRaw = firstOf<any>(x, 'notes');
    const notesList = Array.isArray(notesRaw) ? notesRaw : [];
    const hasFallbackNote = notesList.some((note) => {
      if (!note) return false;
      if (typeof note === 'string') return note.includes('AUTO_FALLBACK:');
      if (typeof note === 'object') {
        const text = String((note as any).text ?? '');
        return text.includes('AUTO_FALLBACK:');
      }
      return false;
    });

    // ✅ نوع التنفيذ (إن لم يرجعه السيرفر نستنتجه)
    const rawType =
      firstOf<string>(x, 'providerType', 'method', 'executionType', 'execution_type') || '';
    let providerType: 'manual' | 'external' | 'internal_codes' | undefined;
    switch (rawType.toLowerCase()) {
      case 'manual': providerType = 'manual'; break;
      case 'internal_codes':
      case 'codes':
      case 'code': providerType = 'internal_codes'; break;
      case 'external':
      case 'api':
      case 'provider': providerType = 'external'; break;
    }
    if (!providerType) {
      providerType = externalOrderId ? 'external' : 'manual';
    }

    const sellUsdAtOrderRaw = firstOf<number>(x, 'sellUsdAtOrder');
    const costUsdAtOrderRaw = firstOf<number>(x, 'costUsdAtOrder');
    const profitUsdAtOrderRaw = firstOf<number>(x, 'profitUsdAtOrder');
    const fxUsdTryAtOrderRaw = firstOf<number>(x, 'fxUsdTryAtOrder', 'fx_usd_try_at_order');
    const fxUsdTryAtApprovalRaw = firstOf<number>(x, 'fxUsdTryAtApproval', 'fx_usd_try_at_approval', 'fxUsdTryAtApproval');

    return {
      id,
      orderNo: firstOf<number>(x, 'orderNo', 'order_no') ?? null,

      username,
      userEmail,

      product,
      package: pkg,

      fxLocked: !!firstOf<boolean>(x, 'fxLocked'),
      approvedLocalDate: firstOf<string>(x, 'approvedLocalDate') ?? undefined,

      // === التكاليف (تدعم مفاتيح بديلة) ===
      costAmount:
        firstOf<number>(x, 'costAmount', 'cost', 'cost_amount', 'serverCost') != null
          ? Number(firstOf<number>(x, 'costAmount', 'cost', 'cost_amount', 'serverCost'))
          : undefined,
      manualCost:
        firstOf<number>(x, 'manualCost', 'manual_cost') != null
          ? Number(firstOf<number>(x, 'manualCost', 'manual_cost'))
          : undefined,

      // === أسعار البيع ===
      sellPriceAmount: sellPriceAmount != null ? Number(sellPriceAmount) : undefined,
      price: sellPriceAmount != null ? Number(sellPriceAmount) : undefined,

      // === العملات ===
      sellPriceCurrency: sellPriceCurrency ?? undefined,
      costCurrency:
        firstOf<string>(x, 'costCurrency', 'cost_currency', 'currency', 'currencyCode', 'currency_code') ?? undefined,
      currencyCode:
        (sellPriceCurrency ??
          firstOf<string>(x, 'costCurrency', 'cost_currency', 'currency', 'currencyCode', 'currency_code')) ?? undefined,

      // === قيم TRY ===
      costTRY:   costTRY   != null ? Number(costTRY)   : undefined,
      sellTRY:   sellTRY   != null ? Number(sellTRY)   : undefined,
    profitTRY: profitTRY != null ? Number(profitTRY) : undefined,
    currencyTRY: currencyTRY ?? undefined,

    // === لقطات USD ===
    sellUsdAtOrder: sellUsdAtOrderRaw != null ? Number(sellUsdAtOrderRaw) : undefined,
    costUsdAtOrder: costUsdAtOrderRaw != null ? Number(costUsdAtOrderRaw) : null,
    profitUsdAtOrder: profitUsdAtOrderRaw != null ? Number(profitUsdAtOrderRaw) : null,
    fxUsdTryAtOrder: fxUsdTryAtOrderRaw != null ? Number(fxUsdTryAtOrderRaw) : null,
    fxUsdTryAtApproval: fxUsdTryAtApprovalRaw != null ? Number(fxUsdTryAtApprovalRaw) : null,

      providerId,
      providerName,
      externalOrderId,
  rootOrderId,
  chainPath,
  mode: mode ?? undefined,
  costSource: costSource ?? undefined,
  costPriceUsd: costPriceUsdRaw != null ? Number(costPriceUsdRaw) : undefined,
  costTryCurrent: costTryCurrentRaw != null ? Number(costTryCurrentRaw) : undefined,
  hasFallbackNote: hasFallbackNote || ((manualNote ?? '').includes('AUTO_FALLBACK:')),
      providerType, // ← مهم

      status,
      userIdentifier: firstOf<string>(x, 'userIdentifier') ?? null,
      extraField: firstOf<string>(x, 'extraField', 'extrafield', 'extra_field') ?? null,

      createdAt,
      sentAt,
      completedAt,
      durationMs,

      productId: firstOf<string>(x, 'productId') ?? undefined,
      quantity: firstOf<number>(x, 'quantity') ?? undefined,

    // ✅ حقول التفاصيل
    manualNote,
      providerMessage,
      pinCode,
      notesCount,
    };
  }


  // ==== جلب تفاصيل للـ Modal بدون استدعاء خارجي ====
  const fetchedOnceRef = useRef<Set<string>>(new Set());
  const fetchOrderDetails = async (id: string) => {
    // لا تُكرر الجلب لنفس الطلب داخل جلسة الصفحة
    if (fetchedOnceRef.current.has(id)) return;
    fetchedOnceRef.current.add(id);

    try {
      // ملاحظة: نستخدم GET داخلي فقط، ولا نستدعي sync-external إطلاقًا
      const { data } = await api.get<{ order?: any }>(API_ROUTES.adminOrders.byId(id));
      const payload = (data as any)?.order ?? data;
      if (!payload) return;
      const merged = normalizeServerOrder(payload);
      setDetailOrder((prev) => (prev ? { ...prev, ...merged } : merged));
    } catch {
      // تجاهل
    }
  };

  // 🔹 الصفحة الأولى (مع فلاتر)
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setErr('');
      setSelected(new Set());

      const url = API_ROUTES.adminOrders.base;
      const params = buildQueryParams();

      const { data } = await api.get<OrdersPageResponse>(url, { params }) as any;
      const rawList = Array.isArray((data as any)?.items) ? (data as any).items : [];
      const list: Order[] = rawList.map(normalizeServerOrder);

      setOrders(list);
      setNextCursor((data as any)?.pageInfo?.nextCursor ?? null);

      if (list.length) await primeProductLogos(list);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'فشل في تحميل الطلبات');
      setOrders([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  };

  // 🔹 تحميل إضافي (Load more)
  const loadMore = async () => {
    if (!nextCursor) return;
    try {
      setLoadingMore(true);
      setErr('');

      const url = API_ROUTES.adminOrders.base;
      const params = { ...buildQueryParams(), cursor: nextCursor };

      const { data } = await api.get<OrdersPageResponse>(url, { params }) as any;
      const rawList = Array.isArray((data as any)?.items) ? (data as any).items : [];
      const more: Order[] = rawList.map(normalizeServerOrder);

      setOrders(prev => [...prev, ...more]);
      setNextCursor((data as any)?.pageInfo?.nextCursor ?? null);

      if (more.length) await primeProductLogos(more);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'تعذّر تحميل المزيد');
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const url = API_ROUTES.admin.integrations.base;
      const res = await api.get<any>(url);

      const list: Provider[] = Array.isArray(res?.data)
        ? res.data
        : Array.isArray((res?.data as any)?.items)
        ? (res.data as any).items
        : [];

      setProviders(list);
    } catch (e: any) {
      setProviders([]);
      show(e?.response?.data?.message || 'تعذّر تحميل قائمة المزوّدين');
    }
  };

  // 🔹 المزوّدون مرة واحدة
  useEffect(() => {
    // fetchProviders(); // معطل للحفاظ على البيانات الوهمية
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔹 تحميل الطلبات عند تغيّر الفلاتر
  useEffect(() => {
    // fetchOrders(); // معطل للحفاظ على البيانات الوهمية
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.status, filters.method, filters.from, filters.to]);

  useEffect(() => {
    tickRef.current = window.setInterval(() => {
      forceTick((x) => x + 1);
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  const providersWithCodes = useMemo(() => {
    const base = Array.isArray(providers) ? providers : [];
    const seen = new Set<string>();
    const normalized: Provider[] = [];
    for (const entry of base) {
      if (!entry) continue;
      const id = String((entry as any).id ?? '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      normalized.push({ id, name: (entry as any).name ?? id });
    }
    if (!seen.has(CODES_PROVIDER_ID)) {
      normalized.push({ id: CODES_PROVIDER_ID, name: t('orders.filters.method.internalCodes') });
    }
    return normalized;
  }, [providers, t]);

  const providerNameOf = (provId?: string | null, fallback?: string | null) => {
    if (fallback) return fallback;
    if (!provId) return null;
    const p = providersWithCodes.find((x) => x.id === provId);
    return p?.name ?? null;
  };

  // 🔹 ترتيب الطلبات: pending في الأعلى، ثم approved، ثم rejected
  const filtered = useMemo(() => {
    return [...orders].sort((a, b) => {
      const statusOrder = { pending: 0, approved: 1, rejected: 2 };
      const aOrder = statusOrder[a.status] ?? 3;
      const bOrder = statusOrder[b.status] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // ترتيب حسب التاريخ (الأحدث أولاً)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [orders]);

  const shownIds = filtered.map((o) => o.id);
  const allShownSelected =
    shownIds.length > 0 && shownIds.every((id) => selected.has(id));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const toggleSelectAll = (checked: boolean) =>
    setSelected((prev) => {
      const s = new Set(prev);
      shownIds.forEach((id) => (checked ? s.add(id) : s.delete(id)));
      return s;
    });

  const { bulkApproveUrl, bulkRejectUrl, bulkDispatchUrl, bulkManualUrl } = {
    bulkApproveUrl: API_ROUTES.adminOrders.bulkApprove,
    bulkRejectUrl: API_ROUTES.adminOrders.bulkReject,
    bulkDispatchUrl: API_ROUTES.adminOrders.bulkDispatch,
    bulkManualUrl: API_ROUTES.adminOrders.bulkManual,
  };

  const { show: toast } = useToast();

  const bulkApprove = async () => {
  if (selected.size === 0) return toast(t('orders.bulk.needSelection'));
    try {
      await api.post(bulkApproveUrl, { ids: [...selected], note: note || undefined });
      const n = selected.size;
      setSelected(new Set());
      setNote('');
  toast(t('orders.bulk.approve.success',{count:n}));
      // إعادة تحميل البيانات من السيرفر لضمان التزامن
      setTimeout(fetchOrders, 300);
    } catch (e: any) {
  toast(e?.response?.data?.message || t('orders.bulk.approve.fail'));
    }
  };

  const bulkReject = async () => {
  if (selected.size === 0) return toast(t('orders.bulk.needSelection'));
    try {
      await api.post(bulkRejectUrl, { ids: [...selected], note: note || undefined });
      const n = selected.size;
      setSelected(new Set());
      setNote('');
  toast(t('orders.bulk.reject.success',{count:n}));
      // إعادة تحميل البيانات من السيرفر لضمان التزامن
      setTimeout(fetchOrders, 300);
    } catch (e: any) {
  toast(e?.response?.data?.message || t('orders.bulk.reject.fail'));
    }
  };

  const bulkDispatch = async () => {
  if (selected.size === 0) return toast(t('orders.bulk.needSelection'));
  if (!providerId) return toast(t('orders.bulk.needProvider'));
    try {
      const { data }: { data: { results?: { success: boolean; message?: string }[]; message?: string; } } =
        await api.post(bulkDispatchUrl, { ids: [...selected], providerId, note: note || undefined });

      if (data?.results?.length) {
        const ok = data.results.filter((r: any) => r.success);
        const failed = data.results.filter((r: any) => !r.success);
  if (ok.length) toast(t('orders.bulk.dispatch.partialSuccess',{count:ok.length}));
  if (failed.length) toast(failed[0]?.message || t('orders.bulk.dispatch.partialFail'));
      } else if (data?.message) {
        toast(data.message);
      } else {
  toast(t('orders.bulk.dispatch.successFallback'));
      }

      setSelected(new Set());
      setNote('');
      setTimeout(fetchOrders, 700);
    } catch (e: any) {
  toast(e?.response?.data?.message || t('orders.bulk.dispatch.fail'));
    }
  };

  const bulkManual = async () => {
  if (selected.size === 0) return toast(t('orders.bulk.needSelection'));
    try {
      await api.post(bulkManualUrl, { ids: [...selected], note: note || undefined });
      setOrders((prev) =>
        prev.map((o) =>
          selected.has(o.id)
            ? {
                ...o,
                providerId: null,
                providerName: null,
                externalOrderId: null,
                providerType: 'manual', // 👈 المهم
              }
            : o
        )
      );
      const n = selected.size;
      setSelected(new Set());
      setNote('');
  toast(t('orders.bulk.manual.success',{count:n}));
    } catch (e: any) {
  toast(e?.response?.data?.message || t('orders.bulk.manual.fail'));
    }
  };

  const renderDuration = (o: Order) => {
    const start =
      (o.sentAt ? new Date(o.sentAt).getTime() : null) ??
      new Date(o.createdAt).getTime();

    if (o.durationMs != null) return fmtHMS(Math.max(0, Number(o.durationMs)));
    if (o.completedAt) {
      const end = new Date(o.completedAt).getTime();
      return fmtHMS(Math.max(0, end - start));
    }
    if (o.status === 'pending') return fmtHMS(Math.max(0, Date.now() - start));
    return fmtHMS(0);
  };

  const displayOrderNumber = (o: Order) => {
    if (o.orderNo != null) return String(o.orderNo);
    return o.id.slice(-6).toUpperCase();
  };

  const openDetails = (o: Order) => {
    setDetailOrder(o);
    setDetailOpen(true);
    fetchOrderDetails(o.id);
  };

  const detailNote = detailOrder
    ? (() => {
        const manual = typeof detailOrder.manualNote === 'string' ? detailOrder.manualNote.trim() : '';
        if (manual) return manual;
        const provider = extractProviderNote(detailOrder.providerMessage);
        return provider ? provider.trim() : '';
      })()
    : '';

  if (!hasLoadedOnce && loading) {
    return <div className="p-4 text-text-primary">{t('orders.loading')}</div>;
  }

  return (
    <div className="text-text-primary bg-bg-base p-6 min-h-screen">
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {err && (
        <div className="mb-4 rounded-lg border-2 border-danger/30 px-4 py-3 bg-danger/10 text-danger font-medium">
          {err}
        </div>
      )}

  <h1 className="text-3xl font-bold mb-6 text-text-primary">{t('orders.pageTitle')}</h1>

      {/* فلاتر */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-border mb-4 bg-bg-surface shadow-sm">
        <div className="flex flex-col">
          <label className="text-xs mb-1 text-text-secondary font-medium">{t('orders.filters.search.label')}</label>
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder={t('orders.filters.search.placeholder')}
            className="px-3 py-2 h-[42px] rounded-lg border border-border bg-bg-input focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs mb-1 text-text-secondary font-medium">{t('orders.filters.status.label')}</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as any }))}
            className="px-3 py-2 h-[42px] rounded-lg border border-border bg-bg-input focus:ring-2 focus:ring-primary/50 transition-all"
          >
            <option value="">{t('orders.filters.status.all')}</option>
            <option value="pending">{t('orders.filters.status.pending')}</option>
            <option value="approved">{t('orders.filters.status.approved')}</option>
            <option value="rejected">{t('orders.filters.status.rejected')}</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs mb-1 text-text-secondary font-medium">{t('orders.filters.method.label')}</label>
            <select
              value={filters.method}
              onChange={(e) => setFilters((f) => ({ ...f, method: e.target.value as any }))}
              className="px-3 py-2 h-[42px] rounded-lg border border-border bg-bg-input focus:ring-2 focus:ring-primary/50 transition-all"
            >
              <option value="">{t('orders.filters.method.all')}</option>
              <option value="manual">{t('orders.filters.method.manual')}</option>
              <option value="internal_codes">{t('orders.filters.method.internalCodes')}</option>
              {(Array.isArray(providers) ? providers : []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

        </div>

        <div className="flex flex-col">
          <label className="text-xs mb-1 text-text-secondary font-medium">{t('orders.filters.from')}</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="px-3 py-2 h-[42px] rounded-lg border border-border bg-bg-input focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs mb-1 text-text-secondary font-medium">{t('orders.filters.to')}</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="px-3 py-2 h-[42px] rounded-lg border border-border bg-bg-input focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>

        <button onClick={fetchOrders} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-contrast hover:bg-primary-hover font-medium shadow-sm transition-all hover:shadow-md">
          {t('orders.filters.refresh')}
        </button>

        <button
          onClick={() => {
            setFilters({ q: '', status: '', method: '', from: '', to: '' });
            (typeof window !== 'undefined') && (document.activeElement as HTMLElement)?.blur?.();
            show(t('orders.filters.clearedToast'));
          }}
          className="px-4 py-2 text-sm rounded-lg bg-danger text-text-inverse hover:brightness-110 font-medium shadow-sm transition-all hover:shadow-md"
        >
          {t('orders.filters.clear')}
        </button>
      </div>

      {/* شريط الإجراءات الجماعية */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 mb-4 rounded-xl border-2 border-primary/30 bg-bg-surface p-4 shadow-lg flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
            <span className="font-bold text-primary text-lg">{selected.size}</span>
            <span className="text-sm text-text-secondary">{t('orders.bulk.selected')}</span>
          </div>
          
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('orders.bulk.note.placeholder')}
            className="px-3 py-2 rounded-lg border border-border bg-bg-input w-64 focus:ring-2 focus:ring-primary/50 transition-all"
          />

          <div className="flex items-center gap-2">
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-bg-input focus:ring-2 focus:ring-primary/50 transition-all"
              title={t('orders.bulk.provider.selectTitle')}
            >
              <option value="">{t('orders.bulk.provider.placeholder')}</option>
              {providersWithCodes.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <button
              onClick={bulkDispatch}
              disabled={!providerId}
              className="px-4 py-2 text-sm rounded-lg bg-warning text-text-inverse hover:brightness-110 disabled:opacity-50 font-medium shadow-sm transition-all"
              title={t('orders.bulk.dispatch.button')}
            >
              {t('orders.bulk.dispatch.button')}
            </button>
          </div>

          <button
            onClick={bulkManual}
            className="px-4 py-2 text-sm rounded-lg bg-bg-surface-alt border border-border hover:bg-bg-surface-hover font-medium transition-all"
            title={t('orders.bulk.manual.button')}
          >
            {t('orders.bulk.manual.button')}
          </button>

          <button
            onClick={bulkApprove}
            className="px-4 py-2 text-sm rounded-lg bg-success text-text-inverse hover:brightness-110 font-medium shadow-sm transition-all"
            title={t('orders.bulk.approve.button')}
          >
            {t('orders.bulk.approve.button')}
          </button>

          <button
            onClick={bulkReject}
            className="px-4 py-2 text-sm rounded-lg bg-danger text-text-inverse hover:brightness-110 font-medium shadow-sm transition-all"
            title={t('orders.bulk.reject.button')}
          >
            {t('orders.bulk.reject.button')}
          </button>
        </div>
      )}

      {/* الجدول */}
      <div className="rounded-xl border border-border overflow-hidden shadow-md bg-bg-surface">
        <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full border-separate border-spacing-y-1.5 border-spacing-x-0 text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-primary/10 to-primary/5 sticky top-0 z-10">
              <th className="text-center border-b-2 border-primary/20 py-3">
                <input type="checkbox" checked={allShownSelected} onChange={(e) => toggleSelectAll(e.target.checked)} className="w-4 h-4" />
              </th>

              <th className="px-0 py-3 text-sm font-bold text-center border-b-2 border-primary/20 w-12">{t('orders.table.logo')}</th>
              <th className="p-3 text-center font-bold border-b-2 border-primary/20">الرقم</th>
              <th className="p-3 text-center font-bold border-b-2 border-primary/20">{t('orders.table.user')}</th>
              <th className="p-3 text-center font-bold border-b-2 border-primary/20">{t('orders.table.package')}</th>
              <th className="p-3 text-center font-bold border-b-2 border-primary/20">{t('orders.table.playerId')}</th>
              <th className="p-3 text-center font-bold border-b-2 border-primary/20">{t('orders.table.cost')}</th>
              <th className="p-3 text-center font-bold border-b-2 border-primary/20">{t('orders.table.price')}</th>
              <th className="p-3 text-center font-bold border-b-2 border-primary/20">{t('orders.table.profit')}</th>
              <th className="px-3 py-3 text-center font-bold border-b-2 border-primary/20">{t('orders.table.status')}</th>
              <th className="p-3 text-center font-bold border-b-2 border-primary/20">جهة API</th>
            </tr>
          </thead>
          <tbody className="bg-bg-surface">
            {filtered.map((o) => {
              const isExternal = !!(o.providerId && o.externalOrderId);
              const providerLabel = isExternal
                ? (providerNameOf(o.providerId, o.providerName) ?? t('orders.table.externalProviderDeleted'))
                : t('orders.table.manualExecution');

              // 👈 احسب رابط الصورة: جرّب الحقول المباشرة ثم fallback من logos (تم جلبه عبر استدعاء منفصل)
              const rawLogo = (pickImageField(o.package) ?? pickImageField(o.product)) || logoUrlOf(o);
              const logoSrc = buildImageSrc(rawLogo || null);

              const pendingRowClass = o.status === 'pending' 
                ? 'bg-yellow-300 dark:bg-yellow-200 text-gray-900' 
                : 'hover:bg-bg-surface-hover';
              return (
                <tr key={o.id} className={`group ${pendingRowClass} transition-colors`}>
                  {(() => {
                    // احسب ربح الدولار لتمييز اللون عند السالب
                    // نفضّل اللقطة المحفوظة، ثم الفرق بين لقطة البيع والشراء
                    (o as any)._usdProfitVal = ((): number | null => {
                      if (o.profitUsdAtOrder != null) return Number(o.profitUsdAtOrder);
                      if (o.sellUsdAtOrder != null && o.costUsdAtOrder != null) {
                        return Number(o.sellUsdAtOrder) - Number(o.costUsdAtOrder);
                      }
                      return null;
                    })();
                    return null;
                  })()}
                  <td className="px-2 py-2 text-center border-b border-border">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleSelect(o.id)}
                      className="w-4 h-4"
                    />
                  </td>

          <td className="px-2 py-2 w-12 border-b border-border">
                    <img
                      src={logoSrc}
                      data-debug-src={logoSrc}
                      alt={o.product?.name || o.package?.name || 'logo'}
            className="block w-full h-12 rounded-lg object-cover shadow-sm"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).onerror = null;
                        e.currentTarget.src = '/images/placeholder.png';
                      }}
                    />
                  </td>

                  <td className="text-center p-2 font-bold border-b border-border">
                    {displayOrderNumber(o)}
                  </td>

                  <td className="text-center p-2 border-b border-border">
                    {o.username || o.userEmail || '-'}
                  </td>

                  <td className="text-center p-2 border-b border-border">
                    {o.package?.name ?? '-'}
                    {(o as any).quantity && (o as any).quantity > 1 ? (
                      <span className="block text-[10px] text-text-secondary mt-1">{t('orders.table.quantityPrefix')} {(o as any).quantity}</span>
                    ) : null}
                  </td>

                  <td className="text-center p-2 border-b border-border w-28 max-w-[7rem]">
                    <div className="leading-tight max-w-[7rem] mx-auto">
                      <div className="truncate font-mono text-xs" title={o.userIdentifier ?? '-' }>{o.userIdentifier ?? '-'}</div>
                      {o.extraField ? (
                        <div className="text-[10px] text-text-secondary mt-1 break-all max-w-[7rem]" title={o.extraField}>{o.extraField}</div>
                      ) : null}
                    </div>
                  </td>

                  <td className="text-center p-2 border-b border-border leading-tight">
                    {(() => { const f = normalizeFinancial(o); return (
                      <div className="text-base text-accent font-bold">
                        {f.costUSD != null ? `$${f.costUSD.toFixed(2)}` : '—'}
                      </div>
                    ); })()}
                  </td>

                  <td className="text-center p-2 border-b border-border leading-tight">
                    {(() => { const f = normalizeFinancial(o); return (
                      <div className="text-base font-bold">
                        {f.sellUSD != null ? `$${f.sellUSD.toFixed(2)}` : '—'}
                      </div>
                    ); })()}
                  </td>

                  <td className="text-center p-2 border-b border-border leading-tight">
                    {(() => { const f = normalizeFinancial(o); const color = f.profitUSD != null ? (f.profitUSD > 0 ? 'text-success' : f.profitUSD < 0 ? 'text-danger' : 'text-text-secondary') : 'text-text-secondary'; return (
                      <div className={`text-base font-bold ${color}`}>
                        {f.profitUSD != null ? `$${Math.abs(f.profitUSD).toFixed(2)}` : '—'}
                      </div>
                    ); })()}
                  </td>

                  {/* تقليل الحشو في خلية الحالة */}
                  <td className="px-3 py-2 border-b border-border">
                    <div className="flex items-center justify-center">
                      <StatusDot status={o.status} onClick={() => openDetails(o)} />
                    </div>
                  </td>

        <td className="text-center p-2 border-b border-border">
            {(() => {
                // PRIORITY 1: Check if this order has a provider_id (dispatched to a provider)
                if (o.providerId) {
                    // This order was dispatched to a provider (external or internal)
                    const providerName = providerNameOf(o.providerId, o.providerName);
                    
                    // Enhanced debug logging
                    console.log('🔍 Provider Debug:', {
                        orderId: o.id,
                        providerId: o.providerId,
                        providerName: o.providerName,
                        providerType: o.providerType,
                        resolvedName: providerName,
                        providersCount: providers.length,
                        mode: o.mode,
                        chainPath: o.chainPath
                    });
                    
                    // Level 1: Use resolved provider name from providers array
                    if (providerName) {
                        if (o.providerType === 'external') {
                            return <span className="text-success" title={`External Provider: ${providerName}`}>{providerName}</span>;
                        } else {
                            return <span className="text-info" title={`Internal Provider: ${providerName}`}>{providerName}</span>;
                        }
                    }
                    
                    // Level 2: Use providerName from order data
                    if (o.providerName) {
                        if (o.providerType === 'external') {
                            return <span className="text-success" title={`External Provider: ${o.providerName}`}>{o.providerName}</span>;
                        } else {
                            return <span className="text-info" title={`Internal Provider: ${o.providerName}`}>{o.providerName}</span>;
                        }
                    }
                    
                    // Level 3: Smart fallback based on provider type and mode
                    if (o.providerType === 'external') {
                        return <span className="text-success" title={`External Provider (ID: ${o.providerId})`}>External Provider</span>;
                    } else if (o.providerType === 'internal_codes') {
                        return <span className="text-success" title="Internal Codes Provider">أكواد داخلية</span>;
                    } else {
                        return <span className="text-info" title={`Internal Provider (ID: ${o.providerId})`}>Internal Provider</span>;
                    }
                }
                
                // PRIORITY 2: Manual orders
                if (o.mode === 'MANUAL' || o.mode === 'manual') {
                    return <span className="text-danger">{t('orders.table.manualExecution')}</span>;
                }
                
                // PRIORITY 3: Default fallback
                return <span className="text-muted">{t('orders.table.manualExecution')}</span>;
            })()}
        </td>

                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td
                  className="bg-bg-surface p-6 text-center text-text-secondary border border-border rounded-md"
                  colSpan={11}
                >
                  {t('orders.empty.filtered')}
                </td>
              </tr>
            )}
          </tbody>

        </table>
        </div>
      </div>

      {/* زر تحميل المزيد */}
      {nextCursor && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-3 rounded-lg bg-bg-surface-alt border-2 border-border hover:bg-bg-surface-hover disabled:opacity-50 font-medium transition-all shadow-sm hover:shadow-md"
          >
            {loadingMore ? t('orders.loading') : t('orders.loadMore')}
          </button>
        </div>
      )}

      {/* مودال تفاصيل الطلب */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailOrder ? t('orders.modal.titleWithNumber', { number: displayOrderNumber(detailOrder) }) : t('orders.modal.title')}
        className="flex items-center justify-center p-4"                // وسط الشاشة
        contentClassName="w-full max-w-2xl max-h-[85vh] rounded-lg"
        lockScroll={false}
      >
        {detailOrder && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* <div>
                <div className="text-text-secondary">المستخدم</div>
                <div>{detailOrder.username || detailOrder.userEmail || '-'}</div>
              </div> */}
              <div>
                <div className="text-text-secondary">{t('orders.modal.package')}</div>
                <div>
                  {detailOrder.package?.name ?? '-'}{' '}
                  {(detailOrder as any).quantity && (detailOrder as any).quantity > 1 ? (
                    <span className="text-text-secondary text-[11px]">{t('orders.modal.quantity',{count:(detailOrder as any).quantity})}</span>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="text-text-secondary">{t('orders.modal.playerId')}</div>
                <div>{detailOrder.userIdentifier ?? '-'}</div>
              </div>
              <div>
                <div className="text-text-secondary">{t('orders.modal.status')}</div>
                <div className="capitalize">
                  {detailOrder.status === 'approved'
                    ? t('orders.status.approved')
                    : detailOrder.status === 'rejected'
                    ? t('orders.status.rejected')
                    : t('orders.status.pending')}
                </div>
              </div>

              {/* <div>
                <div className="text-text-secondary">التكلفة</div>
                <div>{money(detailOrder.costTRY ?? detailOrder.costAmount, detailOrder.currencyTRY ?? detailOrder.costCurrency)}</div>
              </div> */}
              {/* <div>
                <div className="text-text-secondary">سعر البيع</div>
                <div>{money(detailOrder.sellTRY ?? detailOrder.sellPriceAmount ?? detailOrder.price, detailOrder.currencyTRY ?? detailOrder.sellPriceCurrency)}</div>
              </div> */}

              {/* <div>
                <div className="text-text-secondary">الربح</div>
                <div
                  className={
                    (detailOrder.profitTRY ?? ((Number(detailOrder.sellTRY ?? detailOrder.sellPriceAmount ?? detailOrder.price) || 0) - (Number(detailOrder.costTRY ?? detailOrder.costAmount) || 0))) > 0
                      ? 'text-success'
                      : (detailOrder.profitTRY ?? ((Number(detailOrder.sellTRY ?? detailOrder.sellPriceAmount ?? detailOrder.price) || 0) - (Number(detailOrder.costTRY ?? detailOrder.costAmount) || 0))) < 0
                      ? 'text-danger'
                      : ''
                  }
                >
                  {money(
                    detailOrder.profitTRY ?? (
                      (Number(detailOrder.sellTRY ?? detailOrder.sellPriceAmount ?? detailOrder.price) || 0) -
                      (Number(detailOrder.costTRY ?? detailOrder.costAmount) || 0)
                    ),
                    detailOrder.currencyTRY ?? detailOrder.sellPriceCurrency ?? detailOrder.costCurrency
                  )}
                </div>
              </div> */}
{/* 
              <div>
                <div className="text-text-secondary">التنفيذ</div>
                <div>
                  <div className="text-text-secondary">رقم المزوّد الخارجي</div>
                  <div>{detailOrder.externalOrderId ?? '-'}</div>
                </div>
              </div> */}

              {/* ✅ PIN Code (إن وجد) */}
              {detailOrder.pinCode && (
                <div>
                  <div className="text-text-secondary">PIN Code</div>
                  <div className="font-mono">{detailOrder.pinCode}</div>
                </div>
              )}

              {/* ✅ عدد الملاحظات (إن وجد) */}
              {/* {detailOrder.notesCount != null && (
                <div>
                  <div className="text-text-secondary">عدد الملاحظات</div>
                  <div>{detailOrder.notesCount}</div>
                </div>
              )} */}

              {/* ✅ ملاحظة المستأجر (من تنفيذ المزود أو يدوياً) */}
              {detailNote && (
                <div className="sm:col-span-2">
                  <div className="p-3 rounded-md border bg-yellow-50 border-yellow-300 text-yellow-900 whitespace-pre-line break-words">
                    <div className="font-medium mb-1">{t('orders.modal.manualNoteTitle')}</div>
                    <div>{detailNote}</div>
                  </div>
                </div>
              )}

              {/* <div>
                <div className="text-text-secondary">تم الإرسال</div>
                <div>{detailOrder.sentAt ? new Date(detailOrder.sentAt).toLocaleString('en-GB') : '-'}</div>
              </div> */}
              <div>
                <div className="text-text-secondary">{t('orders.modal.arrivalAt')}</div>
                <div>{detailOrder.completedAt ? fmtDateStable(detailOrder.completedAt) : '-'}</div>
              </div>
{/* 
              <div>
                <div className="text-text-secondary">المدة</div>
                <div>{renderDuration(detailOrder)}</div>
              </div> */}

              <div>
                <div className="text-text-secondary">{t('orders.modal.createdAt')}</div>
                <div>{fmtDateStable(detailOrder.createdAt)}</div>
              </div>
            </div>

            {detailOrder.status === 'approved' && detailOrder.fxLocked && (
              <div className="text-xs text-success">
                {detailOrder.approvedLocalDate ? t('orders.modal.fxLockedSince',{date:detailOrder.approvedLocalDate}) : t('orders.modal.fxLocked')}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
