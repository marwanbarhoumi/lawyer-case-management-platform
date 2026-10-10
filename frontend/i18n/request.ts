import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { APP_TIMEZONE, defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';

/** Locale comes from the cookie set by the language switcher, then Accept-Language. */
async function resolveLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;
  const accept = (await headers()).get('accept-language') ?? '';
  return accept.toLowerCase().startsWith('ar') ? 'ar' : defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    timeZone: APP_TIMEZONE,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
