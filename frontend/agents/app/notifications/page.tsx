'use client';

import { useState, useEffect } from 'react';
import { MOCK_NOTIFICATIONS, type MockNotification } from '@/data/mockNotifications';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';

export default function NotificationsPage() {
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
  const [notifications, setNotifications] = useState<MockNotification[]>(MOCK_NOTIFICATIONS);

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

  const formatArabicDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: '-', time: '-' };
    const locale = activeLocale === 'ar' ? 'ar-EG' : activeLocale === 'tr' ? 'tr-TR' : 'en-US';
    const date = d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return { date, time };
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    toast.success(t('notifications.markedAllRead'));
  };

  const markOneAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!namespaceReady) {
    return <div className="max-w-2xl mx-auto p-4 bg-bg-base text-text-primary min-h-screen" dir={activeLocale === 'ar' ? 'rtl' : 'ltr'}>
      <p className="text-center mt-6">{t('common.loading')}</p>
    </div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 bg-bg-base text-text-primary min-h-screen" dir={activeLocale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl">{t('notifications.title')}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all text-sm"
            title={t('notifications.markAllReadTitle')}
          >
            {t('notifications.markAllRead')}
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center text-text-secondary py-12">{t('notifications.empty')}</div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const { date, time } = formatArabicDateTime(n.createdAt);
            const unread = !n.isRead;
            return (
              <div
                key={n.id}
                onClick={() => !n.isRead && markOneAsRead(n.id)}
                className={`bg-bg-surface rounded-xl p-4 text-sm shadow transition-all cursor-pointer ${
                  unread 
                    ? 'ring-2 ring-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10' 
                    : 'hover:bg-bg-surface-alt'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    {/* مؤشر غير مقروء */}
                    {unread && (
                      <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 shrink-0"></div>
                    )}
                    <div className="flex-1">
                      <h2 className={`${unread ? '' : ''}`}>
                        {n.title}
                      </h2>
                      <p className="mt-2 leading-relaxed text-text-secondary">{n.message}</p>
                    </div>
                  </div>
                  
                  <div className="text-xs text-text-secondary text-left leading-tight shrink-0">
                    <div suppressHydrationWarning>{date}</div>
                    <div className="opacity-80" suppressHydrationWarning>{time}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
