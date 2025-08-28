"use client";
import React, { createContext, useContext } from 'react';
import ar from './ar.json';

type Dict = Record<string,string>;
const bundles: Record<string, Dict> = { ar };

interface I18nContextValue {
  t: (k: string, vars?: Record<string, any>) => string;
  locale: string;
}
const I18nContext = createContext<I18nContextValue>({ t: k => k, locale: 'ar' });

function translate(locale: string) {
  const d = bundles[locale] || bundles.ar;
  return (k: string, vars?: Record<string, any>) => {
    let v = d[k] ?? k;
    if (vars) {
      for (const [kk, vv] of Object.entries(vars)) {
        v = v.replace(new RegExp(`\\{${kk}\\}`, 'g'), String(vv));
      }
    }
    return v;
  };
}

export function I18nProvider(props: { locale?: string; children: React.ReactNode }) {
  const locale = props.locale || 'ar';
  const t = translate(locale);
  return <I18nContext.Provider value={{ t, locale }}>{props.children}</I18nContext.Provider>;
}

export function useT() { return useContext(I18nContext).t; }
export default I18nProvider;
