"use client";
import React, { createContext, useContext } from 'react';
import ar from './ar.json';

type Messages = Record<string, string>;
const messages: Record<string, Messages> = { ar };

type I18nCtx = {
  t: (k: string, vars?: Record<string, any>) => string;
  locale: string;
};

const I18nContext = createContext<I18nCtx>({ t: (k) => k, locale: 'ar' });

export function I18nProvider({
  children,
  locale = 'ar',
}: {
  children: React.ReactNode;
  locale?: string;
}) {
  const bundle = messages[locale] || messages.ar;
  const t = (k: string, vars?: Record<string, any>) => {
    let v = bundle[k] || k;
    if (vars) {
      for (const [kk, vv] of Object.entries(vars)) {
        v = v.replace(new RegExp('{' + kk + '}', 'g'), String(vv));
      }
    }
    return v;
  };
  return (
    <I18nContext.Provider value={{ t, locale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext).t;
}

// Default export for convenience (import I18nProvider from '@/i18n')
export default I18nProvider;
