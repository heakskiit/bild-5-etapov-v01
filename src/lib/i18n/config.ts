export const LOCALES = ['en', 'de', 'fr', 'es', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'gp_locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  ru: 'Русский',
};

/**
 * German and French labels can be ~60% longer than English. Buttons therefore
 * use min-width + flexible padding + `text-balance`, never fixed widths.
 * See components/ui/Button.tsx.
 */
export const MAX_LABEL_GROWTH = 1.6;
