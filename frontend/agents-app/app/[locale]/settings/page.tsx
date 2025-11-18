'use client';

import { useTranslations } from 'next-intl';

export default function SettingsPage() {
  const t = useTranslations('Settings');

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-gold">
        {t('title')}
      </h1>

      {/* Content Section */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-8 md:p-12">
        <p className="text-center text-lg md:text-xl text-muted-foreground">
          {t('content')}
        </p>
      </div>
    </div>
  );
}
