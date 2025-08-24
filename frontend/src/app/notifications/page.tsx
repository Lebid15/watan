'use client';

import { useEffect, useState, useRef } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import { useAuthRequired } from '@/hooks/useAuthRequired';

interface Notification {
  id: string;
  title: string | null;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface PageInfo {
  nextCursor?: string | null;
  hasMore?: boolean;
}

type NotificationsResp =
  | Notification[]
  | {
      items: Notification[];
      pageInfo?: PageInfo;
      meta?: any;
    };

const PAGE_LIMIT = 20;

function formatArabicDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '-', time: '-' };
  const date = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

// مقارنة سطحية لمنع إعادة الرسم إن لم تتغير البيانات فعليًا
function sameList(a: Notification[], b: Notification[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.id !== y.id || x.isRead !== y.isRead || x.title !== y.title || x.message !== y.message || x.link !== y.link || x.createdAt !== y.createdAt) {
      return false;
    }
  }
  return true;
}

export default function NotificationsPage() {
  useAuthRequired();

  const [rows, setRows] = useState<Notification[]>([]);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const fetchingRef = useRef(false);

  // pagination
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // ===== جلب الدُفعة الأولى =====
  const fetchFirst = async () => {
    if (fetchingRef.current) return;
    try {
      fetchingRef.current = true;
      setErrMsg('');
      setLoadingFirst(true);

      const res = await api.get<NotificationsResp>(API_ROUTES.notifications.my, {
        params: { limit: PAGE_LIMIT },
      });

      const data = res.data;
      if (Array.isArray(data)) {
        setRows(data);
        setNextCursor(null);
        setHasMore(false);
      } else {
        const items = data.items ?? [];
        const page: PageInfo = data.pageInfo ?? {};
        setRows(items);
        setNextCursor(page.nextCursor ?? null);
        setHasMore(Boolean(page.hasMore));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'حدث خطأ أثناء جلب الإشعارات';
      setErrMsg(Array.isArray(msg) ? msg.join(', ') : msg);
      setRows([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      fetchingRef.current = false;
      setLoadingFirst(false);
    }
  };

  // ===== تحميل المزيد =====
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      setErrMsg('');

      const res = await api.get<NotificationsResp>(API_ROUTES.notifications.my, {
        params: {
          limit: PAGE_LIMIT,
          cursor: nextCursor ?? undefined,
        },
      });

      const data = res.data;
      if (Array.isArray(data)) {
        // الباك رجّع مصفوفة فقط → لا مزيد
        setHasMore(false);
        return;
      }

      const items = data.items ?? [];
      const page: PageInfo = data.pageInfo ?? {};
      setRows(prev => [...prev, ...items]);
      setNextCursor(page.nextCursor ?? null);
      setHasMore(Boolean(page.hasMore));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'تعذّر تحميل المزيد';
      setErrMsg(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoadingMore(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      setErrMsg('');
      // تحديث متفائل
      setRows(prev => prev.map(n => ({ ...n, isRead: true })));
      await api.patch(API_ROUTES.notifications.readAll, {});
      // مزامنة هادئة: إعادة تحميل أول صفحة (نفس الكيرسرات)
      fetchFirst();
    } catch {
      setErrMsg('فشل في تعليم الكل كمقروء');
      fetchFirst();
    }
  };

  const markOneAsRead = async (id: string) => {
    try {
      setErrMsg('');
      // تحديث متفائل
      setRows(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
      await api.patch(API_ROUTES.notifications.readOne(id), {});
      // مزامنة هادئة
      // (إبقاء الصفحة كما هي يكفي؛ أو يمكنك استدعاء fetchFirst إن رغبت)
    } catch {
      setErrMsg('فشل في تعليم الإشعار كمقروء');
      fetchFirst();
    }
  };

  useEffect(() => {
    fetchFirst();
    const onFocus = () => fetchFirst();
    const onVis = () => { if (document.visibilityState === 'visible') fetchFirst(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingFirst) return <div className="p-4 text-text-secondary">جارٍ التحميل...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 bg-bg-base text-text-primary" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">الإشعارات</h1>
        <div className="flex gap-2">
          <button onClick={fetchFirst} className="btn btn-secondary" title="تحديث">
            تحديث
          </button>
          <button
            onClick={markAllAsRead}
            className="btn btn-primary hover:bg-primary-hover text-primary-contrast"
            title="تعليم الكل كمقروء"
          >
            تعليم الكل كمقروء
          </button>
        </div>
      </div>

      {errMsg && <div className="mb-4 text-danger text-sm">{errMsg}</div>}

      {rows.length === 0 ? (
        <div className="text-text-secondary">لا توجد إشعارات</div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((n) => {
              const { date, time } = formatArabicDateTime(n.createdAt);
              const unread = !n.isRead;
              return (
                <div
                  key={n.id}
                  className={[
                    'card p-4 text-sm shadow cursor-default transition',
                    unread ? 'bg-warning/10 ring-1 ring-warning/30' : '',
                    'hover:bg-bg-surface-alt'
                  ].join(' ')}
                >

                  <div className="flex items-start justify-between gap-3">
                    <h2 className={`font-semibold ${unread ? 'text-text-primary' : 'text-text-primary'}`}>
                      {n.title || 'إشعار'}
                    </h2>
                    <div className="text-xs text-text-secondary text-left leading-tight">
                      <div>{date}</div>
                      <div className="opacity-80">{time}</div>
                    </div>
                  </div>

                  <p className="mt-2 leading-relaxed text-text-primary">{n.message}</p>
                </div>
              );
            })}
          </div>

          {/* زر تحميل المزيد */}
          <div className="mt-4 flex items-center justify-center">
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="btn btn-primary text-xs disabled:opacity-60"
              >
                {loadingMore ? 'جارِ التحميل…' : 'تحميل المزيد'}
              </button>
            ) : (
              <div className="py-2 text-xs text-text-secondary">لا يوجد المزيد</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
