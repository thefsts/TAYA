export const locales = ['en', 'es', 'fr', 'de', 'pt', 'ar', 'zh', 'vi', 'ko', 'tl'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ar: 'العربية',
  zh: '中文',
  vi: 'Tiếng Việt',
  ko: '한국어',
  tl: 'Tagalog',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  pt: '🇧🇷',
  ar: '🇸🇦',
  zh: '🇨🇳',
  vi: '🇻🇳',
  ko: '🇰🇷',
  tl: '🇵🇭',
};

export const isRTL = (locale: Locale): boolean => {
  return locale === 'ar';
};