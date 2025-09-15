/**
 * next-i18next configuration
 */
module.exports = {
  i18n: {
    defaultLocale: 'ar',
    locales: ['ar', 'en', 'tr'],
    localeDetection: false,
  },
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};
