import i18n from 'i18next';

const FALLBACK_LANG = 'ar';
const DEFAULT_NAMESPACE = 'common';

if (!i18n.isInitialized) {
  i18n.init({
    lng: FALLBACK_LANG,
    fallbackLng: FALLBACK_LANG,
    defaultNS: DEFAULT_NAMESPACE,
    interpolation: { escapeValue: false },
    resources: {},
  });
}

export async function loadNamespace(locale: string, namespace = DEFAULT_NAMESPACE) {
  if (i18n.hasResourceBundle(locale, namespace)) return;
  const res = await fetch(`/locales/${locale}/${namespace}.json`, { cache: 'no-store' });
  if (!res.ok) return;
  const data = await res.json();
  i18n.addResourceBundle(locale, namespace, data, true, true);
}

export function setLocale(locale: string) {
  if (!locale) return;
  i18n.changeLanguage(locale);
}

export default i18n;
