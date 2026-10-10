import type messages from './messages/fr.json';
import type { Locale } from './i18n/config';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof messages;
    Locale: Locale;
  }
}
