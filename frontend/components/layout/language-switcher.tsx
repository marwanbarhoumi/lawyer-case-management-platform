'use client';

import { useTransition } from 'react';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LOCALE_COOKIE, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export const LOCALE_LABELS: Record<Locale, string> = { fr: 'Français', ar: 'العربية' };

export function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** Toggles FR ⇄ AR. The new locale also flips the document direction (LTR/RTL). */
export function LanguageSwitcher({
  className,
  variant = 'ghost',
}: {
  className?: string;
  variant?: 'ghost' | 'outline';
}) {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Locale = locale === 'fr' ? 'ar' : 'fr';

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={cn('gap-1.5', className)}
      disabled={pending}
      aria-label={`${t('language')}: ${LOCALE_LABELS[next]}`}
      onClick={() => {
        setLocaleCookie(next);
        startTransition(() => router.refresh());
      }}
    >
      <Languages aria-hidden />
      <span lang={next}>{LOCALE_LABELS[next]}</span>
    </Button>
  );
}
