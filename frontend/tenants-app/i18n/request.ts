import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const localeValue = await requestLocale;
  
  const locale = !localeValue || !routing.locales.includes(localeValue as any)
    ? routing.defaultLocale
    : localeValue;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
