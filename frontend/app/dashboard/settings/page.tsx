'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Languages, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_LABELS, setLocaleCookie } from '@/components/layout/language-switcher';
import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { locales, localeDirection } from '@/i18n/config';
import { cn } from '@/lib/utils';

function SettingsLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof UserRound;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader className="flex-nowrap items-center">
          <span className="bg-navy flex size-10 shrink-0 items-center justify-center rounded-lg text-white">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" aria-hidden />
        </CardHeader>
      </Card>
    </Link>
  );
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const admin = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const { hasRole } = useAuth();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <div className="grid gap-4 md:grid-cols-2">
        <SettingsLink
          href="/dashboard/settings/profile"
          icon={UserRound}
          title={t('profile')}
          description={t('profileDescription')}
        />
        <SettingsLink
          href="/dashboard/settings/security"
          icon={ShieldCheck}
          title={t('security')}
          description={t('securityDescription')}
        />
        {hasRole('ADMIN') && (
          <SettingsLink
            href="/dashboard/admin/settings"
            icon={SlidersHorizontal}
            title={admin('settingsTitle')}
            description={admin('settingsSubtitle')}
          />
        )}
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Languages className="text-gold size-4" aria-hidden />
              {t('language')}
            </CardTitle>
            <CardDescription className="mt-1">{t('languageDescription')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label={t('language')} className="grid gap-3 sm:grid-cols-2">
            {locales.map((value) => {
              const active = value === locale;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={pending}
                  lang={value}
                  dir={localeDirection[value]}
                  onClick={() => {
                    if (active) return;
                    setLocaleCookie(value);
                    startTransition(() => router.refresh());
                  }}
                  className={cn(
                    'focus-visible:ring-ring flex items-center justify-between rounded-lg border p-4 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    active ? 'border-gold bg-accent/50' : 'hover:bg-muted',
                  )}
                >
                  <span className="font-medium">{LOCALE_LABELS[value]}</span>
                  <span className="text-muted-foreground text-xs uppercase">
                    {localeDirection[value]}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
