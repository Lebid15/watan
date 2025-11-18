'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { MOCK_ORDERS, type OrderStatus } from '@/data/mockOrders';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';

function currencySymbol(code?: string) {
  switch ((code || '').toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'TRY': return '₺';
    case 'EGP': return '£';
    case 'SAR': return '﷼';
    case 'AED': return 'د.إ';
    case 'SYP': return 'ل.س';
    default: return code || '';
  }
}

export default function OrdersPage() {
  const { user } = useUser();
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<typeof MOCK_ORDERS[0] | null>(null);

  const activeLocale = i18n.language || i18n.resolvedLanguage || 'ar';

  useEffect(() => {
    let mounted = true;
    setNamespaceReady(false);
    (async () => {
      try {
        await loadNamespace(activeLocale, 'common');
      } catch {}
      if (mounted) setNamespaceReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [activeLocale]);

  const getStatusText = (s: OrderStatus) =>
    s === 'approved' ? t('orders.status.approved') : s === 'rejected' ? t('orders.status.rejected') : t('orders.status.pending');
  
  const getStatusColor = (s: OrderStatus) =>
    s === 'approved' ? 'text-green-500' : s === 'rejected' ? 'text-red-500' : 'text-yellow-500';
  
  const getStatusIcon = (s: OrderStatus) =>
    s === 'approved' ? '✓' : s === 'rejected' ? '❌' : '⏳';

  const displayOrderNumber = (orderNo: number) => String(orderNo);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = (filter === 'all' ? MOCK_ORDERS : MOCK_ORDERS.filter((o) => o.status === filter))
      .filter((o) => {
        if (!query) return true;
        const identifier = (o.userIdentifier ?? '').toLowerCase();
        const extra = (o.extraField ?? '').toLowerCase();
        return identifier.includes(query) || extra.includes(query);
      });
    
    // ترتيب: الطلبات قيد المعالجة (pending) دائماً في الأعلى
    return filtered.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filter, searchQuery, t]);

  if (!namespaceReady) {
    return <div className="min-h-screen p-4 bg-bg-base text-text-primary" dir="rtl">
      <p className="text-center mt-6">{t('common.loading')}</p>
    </div>;
  }

  return (
    <div className="min-h-screen p-4 bg-bg-base text-text-primary" dir="rtl">
      <style>{`
        .pending-order-card {
          background-color: #584402ff;
          border-color: #F7C15A;
        }
      `}</style>

      <h1 className="text-xl font-bold mb-4">{t('orders.myOrders')}</h1>

      {/* الفلترة والبحث */}
      <div className="mb-6 space-y-3">
        {/* البحث */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('orders.search.placeholder')}
            className="flex-1 px-4 py-2 rounded-lg bg-bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => {}}
            className="w-10 h-10 rounded-full bg-primary text-white grid place-items-center"
            title={t('orders.search.button')}
          >
            🔍
          </button>
        </div>

        {/* أزرار الحالة */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'approved', 'rejected', 'pending'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-4 py-2 rounded-lg text-xl font-medium transition-all ${
                filter === k
                  ? k === 'all'
                    ? 'bg-primary text-white'
                    : k === 'approved'
                    ? 'bg-green-500 text-white'
                    : k === 'rejected'
                    ? 'bg-red-500 text-white'
                    : 'bg-yellow-500 text-white'
                  : 'bg-bg-surface border border-border hover:bg-bg-surface-alt'
              }`}
            >
              {k === 'all' ? <span className="text-sm">{t('orders.filters.status.all')}</span> : k === 'approved' ? '✓' : k === 'rejected' ? '✕' : '⏳'}
            </button>
          ))}
        </div>
      </div>

      {/* القائمة */}
      {filteredOrders.length === 0 ? (
        <div className="text-center text-text-secondary py-12">
          <p className="text-lg">{filter !== 'all' ? `${t('orders.noOrdersWithStatus')} "${getStatusText(filter)}"` : t('orders.noOrders')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const dt = new Date(order.createdAt);
            const sym = currencySymbol(order.currencyCode);
            return (
              <div
                key={order.id}
                className={`relative bg-bg-surface rounded-xl p-4 border border-border shadow ${
                  order.status === 'pending' ? 'pending-order-card' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* اليمين: رقم + اسم */}
                  <div className="flex-1">
                    <div className="text-text-secondary text-xs mb-1">
                      رقم: {displayOrderNumber(order.orderNo)}
                    </div>
                    <div className="">
                      {order.package.name}
                      {order.quantity > 1 && (
                        <span className="text-xs text-text-secondary mr-1">× {order.quantity}</span>
                      )}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">{order.product.name}</div>
                  </div>

                  {/* الوسط: المعرف + السعر */}
                  <div className="flex-1 text-center">
                    <div className="text-sm break-all">{order.userIdentifier}</div>
                    {order.extraField && (
                      <div className="text-xs text-text-secondary mt-1">{order.extraField}</div>
                    )}
                    <div className="text-primary mt-2">
                      {sym} {order.totalPrice.toFixed(2)}
                    </div>
                  </div>

                  {/* اليسار: الحالة + التاريخ + الأيقونات */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 justify-end mb-2">
                      {/* أيقونة الحالة */}
                      <div className={`flex items-center gap-1 ${getStatusColor(order.status)}`}>
                        <span className="text-2xl">{getStatusIcon(order.status)}</span>
                        <span className="text-sm hidden md:inline">{getStatusText(order.status)}</span>
                      </div>
                      {/* أيقونة التفاصيل */}
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-2xl text-primary hover:text-primary/80"
                        title="عرض التفاصيل"
                      >
                        📝
                      </button>
                    </div>
                    <div className="text-xs text-text-secondary">
                      <div>{dt.toLocaleDateString('ar-EG')}</div>
                      <div>{dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة التفاصيل */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface rounded-xl p-6 w-full max-w-md border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl">{t('orders.modal.title')}</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-2xl text-text-secondary hover:text-red-500"
                title="إغلاق"
              >
                ✖
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">رقم الطلب:</span>
                <span className="">{displayOrderNumber(selectedOrder.orderNo)}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">اسم المنتج:</span>
                <span>{selectedOrder.product.name}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">الباقة:</span>
                <span>
                  {selectedOrder.package.name}
                  {selectedOrder.quantity > 1 && (
                    <span className="text-text-secondary"> (×{selectedOrder.quantity})</span>
                  )}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">{t('orders.detail.identifier')}</span>
                <span className="break-all">{selectedOrder.userIdentifier}</span>
              </div>

              {selectedOrder.extraField && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">{t('orders.detail.additionalInfo')}</span>
                  <span>{selectedOrder.extraField}</span>
                </div>
              )}

              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">{t('orders.detail.price')}</span>
                <span className="text-primary">
                  {currencySymbol(selectedOrder.currencyCode)} {selectedOrder.totalPrice.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">{t('orders.detail.status')}</span>
                <span className={getStatusColor(selectedOrder.status)}>
                  {getStatusIcon(selectedOrder.status)} {getStatusText(selectedOrder.status)}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">{t('orders.detail.date')}</span>
                <span>{new Date(selectedOrder.createdAt).toLocaleString(activeLocale === 'ar' ? 'ar-EG' : activeLocale === 'tr' ? 'tr-TR' : 'en-US')}</span>
              </div>

              {/* PIN Code */}
              {selectedOrder.pinCode && (
                <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="mb-2 text-green-600">{t('orders.detail.pinCode')}</div>
                  <div className="font-mono text-lg tracking-wider text-green-700 break-all">
                    {selectedOrder.pinCode}
                  </div>
                </div>
              )}

              {/* الملاحظة */}
              {selectedOrder.note && (
                <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="mb-2 text-yellow-700">{t('orders.detail.note')}</div>
                  <div className="text-yellow-800 break-words whitespace-pre-wrap">
                    {selectedOrder.note}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full mt-6 py-3 bg-bg-base border border-border rounded-lg hover:bg-bg-surface-alt transition-all"
            >
              {t('orders.detail.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
