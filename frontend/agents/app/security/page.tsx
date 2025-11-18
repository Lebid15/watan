'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';
import { HiShieldCheck, HiLockClosed, HiKey } from 'react-icons/hi';
import Link from 'next/link';

export default function SecurityPage() {
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
          {t('security.title')}
        </h1>

        <div className="space-y-4">
          {/* Change Password */}
          <div className="bg-bg-surface rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <HiLockClosed className="text-2xl text-primary" />
              <h2 className="text-xl font-semibold">{t('security.changePassword')}</h2>
            </div>
            <p className={`text-text-secondary mb-4 ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('security.changePasswordDesc')}
            </p>
            <button className="btn btn-primary">
              {t('security.changePasswordButton')}
            </button>
          </div>

          {/* Two-Factor Authentication */}
          <div className="bg-bg-surface rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <HiShieldCheck className="text-2xl text-primary" />
              <h2 className="text-xl font-semibold">{t('security.twoFactor')}</h2>
            </div>
            <p className={`text-text-secondary mb-4 ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('security.twoFactorDesc')}
            </p>
            <Link href="/totp-setup" className="btn btn-primary">
              {t('security.setupTwoFactor')}
            </Link>
          </div>

          {/* Sessions */}
          <div className="bg-bg-surface rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <HiKey className="text-2xl text-primary" />
              <h2 className="text-xl font-semibold">{t('security.sessions')}</h2>
            </div>
            <p className={`text-text-secondary mb-4 ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('security.sessionsDesc')}
            </p>
            <button className="btn btn-danger">
              {t('security.logoutAll')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
