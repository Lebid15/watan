'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';

export default function APIPage() {
  const t = useTranslations('API');
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [allowAllRequests, setAllowAllRequests] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  // بيانات تجريبية
  const apiToken = '690876fbd4ad96625847#ac0ce5e683093e1c2d7bcc6e05';
  const allowedIPs = [
    '85.111.9.75',
    '92.113.22.6',
    '212.175.23.62',
    '52.13.128.108',
    '44.229.227.142'
  ];

  const handleCopyToken = () => {
    navigator.clipboard.writeText(apiToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyIP = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-gold">
        {t('title')}
      </h1>

      {/* Account Information Section */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold">{t('accountInfo')}</h2>

        {/* API Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {t('apiToken')}
          </label>
          <div className="relative">
            <input
              type="text"
              value={apiToken}
              readOnly
              className="w-full bg-background/50 border border-gold/50 rounded-lg px-4 py-3 pr-12 font-mono text-sm text-gold"
              dir="ltr"
            />
            <button
              onClick={handleCopyToken}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gold/10 rounded-md transition-colors"
            >
              {copiedToken ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-gold" />
              )}
            </button>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            webhook url
          </label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
            dir="ltr"
          />
        </div>

        {/* Allow All Requests Checkbox */}
        <div className="flex items-center justify-between p-4 bg-background/30 border border-border rounded-lg">
          <div className="flex-1">
            <h3 className="font-semibold mb-1">{t('allowAllRequests')}</h3>
            <p className="text-xs text-muted-foreground">{t('allowAllRequestsDescription')}</p>
          </div>
          <button
            onClick={() => setAllowAllRequests(!allowAllRequests)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              allowAllRequests ? 'bg-green-500' : 'bg-muted'
            }`}
            dir="ltr"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                allowAllRequests ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Allowed IPs */}
        {!allowAllRequests && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('allowedIPs')}
            </label>
            <p className="text-xs text-muted-foreground">{t('allowedIPsDescription')}</p>
            
            <div className="bg-background/30 border border-border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto" dir="ltr">
              {allowedIPs.map((ip, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 px-3 bg-card/30 rounded-md hover:bg-card/50 transition-colors"
                >
                  <span className="font-mono text-sm">{ip}</span>
                  <button
                    onClick={() => handleCopyIP(ip)}
                    className="p-1.5 hover:bg-gold/10 rounded-md transition-colors"
                  >
                    {copiedIp ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-gold" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning Message when enabled */}
        {allowAllRequests && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center mt-0.5">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-red-500 font-medium">
                {t('warningMessage')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* API Documentation Section */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">{t('forDevelopers')}</h2>
        
        {/* API Documentation Link */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {t('apiDocumentationLink')}
          </label>
          <div className="relative">
            <input
              type="text"
              value="https://api.wtn4.com/api-docs"
              readOnly
              className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 font-mono text-sm text-blue-400"
              dir="ltr"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText('https://api.wtn4.com/api-docs');
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gold/10 rounded-md transition-colors"
            >
              <Copy className="w-4 h-4 text-muted-foreground hover:text-gold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
