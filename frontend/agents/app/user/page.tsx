'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/context/UserContext';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';
import { HiSave } from 'react-icons/hi';

export default function ProfilePage() {
  const { user } = useUser();
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (user?.name) {
      setDisplayName(user.name);
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    // محاكاة حفظ البيانات
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    // يمكن إضافة toast notification هنا
  };

  if (!namespaceReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-primary">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className={`text-2xl font-bold mb-6 ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
          {t('profile.title')}
        </h1>

        <div className="bg-bg-surface rounded-lg shadow p-6 space-y-6">
          {/* Email - Read Only */}
          <div className="space-y-2">
            <label className={`block text-sm font-medium text-text-secondary ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('profile.email')}
            </label>
            <input
              type="email"
              value={user?.email || '-'}
              readOnly
              className="w-full bg-white border border-border rounded px-4 py-2 text-gray-800 cursor-not-allowed"
            />
          </div>

          {/* Display Name - Editable */}
          <div className="space-y-2">
            <label className={`block text-sm font-medium text-text-secondary ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('profile.displayName')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-white border border-border rounded px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={t('profile.displayNamePlaceholder')}
            />
          </div>

          {/* Balance - Read Only */}
          <div className="space-y-2">
            <label className={`block text-sm font-medium text-text-secondary ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('profile.balance')}
            </label>
            <input
              type="text"
              value={`${user?.balance || '0'} ${user?.currency || 'USD'}`}
              readOnly
              className="w-full bg-white border border-border rounded px-4 py-2 text-gray-800 cursor-not-allowed"
            />
          </div>

          {/* Negative Limit */}
          <div className="space-y-2">
            <label className={`block text-sm font-medium text-text-secondary ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('profile.negativeLimit')}
            </label>
            <input
              type="text"
              value="0 USD"
              readOnly
              className="w-full bg-white border border-border rounded px-4 py-2 text-gray-800 cursor-not-allowed"
            />
          </div>

          {/* Price Group - Read Only */}
          <div className="space-y-2">
            <label className={`block text-sm font-medium text-text-secondary ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('profile.priceGroup')}
            </label>
            <input
              type="text"
              value={user?.priceGroup?.name || t('profile.defaultPriceGroup')}
              readOnly
              className="w-full bg-white border border-border rounded px-4 py-2 text-gray-800 cursor-not-allowed"
            />
          </div>

          {/* Mobile Number - Read Only */}
          <div className="space-y-2">
            <label className={`block text-sm font-medium text-text-secondary ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
              {t('profile.mobile')}
            </label>
            <input
              type="text"
              value="+963 999 123 456"
              readOnly
              className="w-full bg-white border border-border rounded px-4 py-2 text-gray-800 cursor-not-allowed"
              dir="ltr"
            />
          </div>

          {/* Save Button */}
          <div className={`pt-4 ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2 px-6 py-3"
            >
              <HiSave size={20} />
              {saving ? t('profile.saving') : t('profile.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
