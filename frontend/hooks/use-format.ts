'use client';

import { useCallback, useMemo } from 'react';
import { useFormatter, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { intlLocale } from '@/i18n/config';
import { systemService } from '@/services/resources';
import { useAuth } from '@/components/providers/auth-provider';

export function useSettings() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['settings'],
    queryFn: systemService.settings,
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}

/** Locale-aware formatting helpers (dates in the firm timezone, money in the firm currency). */
export function useFormat() {
  const format = useFormatter();
  const locale = useLocale();
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? 'MAD';

  const money = useCallback(
    (value: number | string | null | undefined, currencyOverride?: string) =>
      new Intl.NumberFormat(intlLocale[locale], {
        style: 'currency',
        currency: currencyOverride ?? currency,
        maximumFractionDigits: 2,
      }).format(Number(value ?? 0)),
    [locale, currency],
  );

  return useMemo(
    () => ({
      currency,
      money,
      date: (value: string | Date | null | undefined) =>
        value
          ? format.dateTime(new Date(value), { day: '2-digit', month: 'short', year: 'numeric' })
          : '—',
      dateLong: (value: string | Date) =>
        format.dateTime(new Date(value), {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      dateTime: (value: string | Date) =>
        format.dateTime(new Date(value), {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      weekdayShort: (value: string | Date) =>
        format.dateTime(new Date(value), { weekday: 'short', day: 'numeric', month: 'short' }),
      relative: (value: string | Date) => format.relativeTime(new Date(value)),
      number: (value: number) => format.number(value),
      monthLabel: (month: string) =>
        format.dateTime(new Date(`${month}-15T12:00:00Z`), { month: 'short', year: '2-digit' }),
    }),
    [format, money, currency],
  );
}
