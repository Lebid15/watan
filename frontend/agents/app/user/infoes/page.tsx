'use client';

import { MOCK_INFOES } from '@/data/mockInfoes';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { loadNamespace } from '@/i18n/client';

export default function InfoesPage() {
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
    <div className="min-h-screen bg-bg-base p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-bg-surface border border-border rounded-lg p-6">
          <h1 className={`text-2xl text-text-primary mb-6 ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
            {t('user.infoes.title')}
          </h1>
          <div className={`whitespace-pre-wrap text-text-primary leading-relaxed ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
            {MOCK_INFOES}
          </div>
        </div>
      </div>
    </div>
  );
}
