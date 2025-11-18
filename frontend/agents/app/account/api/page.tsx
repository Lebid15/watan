'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';
import { HiKey, HiClipboardCopy } from 'react-icons/hi';

export default function ApiPage() {
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState('');
  const activeLocale = i18n.language || i18n.resolvedLanguage || 'ar';

  useEffect(() => {
    // Load token from localStorage on client side only
    if (typeof window !== 'undefined') {
      setToken(localStorage.getItem('token') || 'demo-token-12345-abcdef');
    }
  }, []);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          {t('api.title')}
        </h1>

        <div className="bg-bg-surface rounded-lg shadow p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <HiKey className="text-2xl text-primary" />
            <h2 className="text-xl font-semibold">{t('api.tokenTitle')}</h2>
          </div>

          <p className={`text-text-secondary mb-4 ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
            {t('api.description')}
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={token}
              className="flex-1 bg-bg-primary border border-border rounded px-4 py-2 text-sm font-mono"
            />
            <button
              onClick={handleCopy}
              className="btn btn-primary flex items-center gap-2"
            >
              <HiClipboardCopy />
              {copied ? t('api.copied') : t('api.copy')}
            </button>
          </div>

          <div className={`mt-6 p-4 bg-amber-50 border border-amber-200 rounded ${activeLocale === 'ar' ? 'text-right' : 'text-left'}`}>
            <p className="text-amber-900 text-sm">
              ⚠️ {t('api.warning')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
