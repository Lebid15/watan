'use client';

import { useCallback } from 'react';
import i18n from './client';
export { loadNamespace, setLocale } from './client';

export function useT(namespace = 'common') {
  const lang = i18n.language || 'ar';
  return useCallback(
    (key: string) => {
      const value = i18n.getResource(lang, namespace, key);
      return (typeof value === 'string' ? value : key) as string;
    },
    [lang, namespace]
  );
}

export default i18n;
