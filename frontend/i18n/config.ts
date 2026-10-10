export const locales = ['fr', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = { fr: 'ltr', ar: 'rtl' };

/** BCP-47 tags used for Intl formatting (Latin digits for Arabic, common in the Maghreb). */
export const intlLocale: Record<Locale, string> = { fr: 'fr-FR', ar: 'ar-MA' };

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? 'Africa/Casablanca';

export function isLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale);
}
