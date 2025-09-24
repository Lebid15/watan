import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// We'll lazy load via HTTP fetch from /public/locales (served statically)
// Basic singleton init guard
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      lng: 'ar',
      fallbackLng: 'ar',
      supportedLngs: ['ar', 'en', 'tr'],
      defaultNS: 'common',
      ns: ['common'],
      react: { useSuspense: false },
      interpolation: { escapeValue: false },
      resources: {}, // empty, we load on demand
    });
}

export async function loadNamespace(locale: string, ns: string = 'common') {
  try {
    if (i18n.hasResourceBundle(locale, ns)) return;
    const res = await fetch(`/locales/${locale}/${ns}.json`);
    if (!res.ok) return;
    const data = await res.json();
    i18n.addResourceBundle(locale, ns, data, true, true);
  } catch {}
}

export function setLocale(locale: string) {
  const supported = ['ar','en','tr'];
  const final = supported.includes(locale) ? locale : 'ar';
  i18n.changeLanguage(final);
  try { localStorage.setItem('locale', final); } catch {}
  try { document.cookie = `NEXT_LOCALE=${final}; Path=/; Max-Age=${60*60*24*365}`; } catch {}
  // Document direction
  if (typeof document !== 'undefined') {
    document.documentElement.lang = final;
    document.documentElement.dir = final === 'ar' ? 'rtl' : 'ltr';
  }
}

export default i18n;
