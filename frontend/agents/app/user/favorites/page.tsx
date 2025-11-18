'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';
import { HiStar, HiOutlineStar } from 'react-icons/hi';

export default function FavoritesPage() {
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
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

  if (!namespaceReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-primary">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className={`text-2xl font-bold mb-6 ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
          {t('favorites.title')}
        </h1>

        <div className="bg-bg-surface rounded-lg shadow p-8 text-center">
          <HiOutlineStar className="mx-auto text-6xl text-text-secondary mb-4" />
          <p className="text-text-secondary">{t('favorites.empty')}</p>
        </div>
      </div>
    </div>
  );
}
