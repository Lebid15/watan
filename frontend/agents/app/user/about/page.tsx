'use client';

import { MOCK_ABOUT } from '@/data/mockAbout';

'use client';
import { useTranslation } from 'react-i18next';

export default function AboutPage() {
  const { t } = useTranslation('common');
  
  return (
    <div className="min-h-screen bg-bg-base p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-bg-surface border border-border rounded-lg p-6">
          <h1 className="text-2xl text-text-primary mb-6">{t('user.about.title')}</h1>
          <div className="whitespace-pre-wrap text-text-primary leading-relaxed">
            {MOCK_ABOUT}
          </div>
        </div>
      </div>
    </div>
  );
}
