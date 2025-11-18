import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

type SupportedLocale = (typeof routing)['locales'][number];

export default getRequestConfig(async ({ requestLocale }) => {
  const resolvedLocale = (await requestLocale) ?? routing.defaultLocale;
  const locale = routing.locales.includes(resolvedLocale as SupportedLocale)
    ? resolvedLocale
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
