'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { todayInput, zonedDateTimeToIso, zonedDay } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { hearingsService } from '@/services/resources';
import type { Hearing, HearingStatus } from '@/types/api';

const MAX_PAGES = 5;
const STATUS_STYLE: Record<HearingStatus, string> = {
  SCHEDULED: 'border-s-navy bg-secondary',
  COMPLETED: 'border-s-emerald-500 bg-emerald-50 text-emerald-900',
  POSTPONED: 'border-s-amber-500 bg-amber-50 text-amber-900',
  CANCELLED: 'border-s-slate-300 bg-muted text-muted-foreground line-through',
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Month grid (Monday first) in the firm's timezone, independent of the browser timezone. */
function buildMonth(year: number, month: number) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: Array<string | null> = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(`${year}-${pad(month)}-${pad(day)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return {
    cells,
    first: `${year}-${pad(month)}-01`,
    last: `${year}-${pad(month)}-${pad(daysInMonth)}`,
  };
}

async function fetchMonth(from: string, to: string, search?: string): Promise<Hearing[]> {
  const results: Hearing[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, meta } = await hearingsService.list({
      from,
      to,
      search,
      page,
      pageSize: 100,
      sortBy: 'date',
      sortOrder: 'asc',
    });
    results.push(...data);
    if (page >= meta.totalPages) break;
  }
  return results;
}

export function HearingCalendar({ search }: { search?: string }) {
  const t = useTranslations('hearings');
  const format = useFormatter();
  const today = todayInput();
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));
  const { cells, first, last } = useMemo(() => buildMonth(cursor.year, cursor.month), [cursor]);
  const from = zonedDateTimeToIso(first, '00:00');
  const to = zonedDateTimeToIso(last, '23:59');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hearings', 'calendar', from, to, search],
    queryFn: () => fetchMonth(from, to, search),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Hearing[]>();
    for (const hearing of data ?? []) {
      const key = zonedDay(hearing.date);
      map.set(key, [...(map.get(key) ?? []), hearing]);
    }
    return map;
  }, [data]);

  const move = (delta: number) =>
    setCursor(({ year, month }) => {
      const index = year * 12 + (month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });

  const weekdays = Array.from({ length: 7 }, (_, index) =>
    format.dateTime(new Date(Date.UTC(2024, 0, 1 + index, 12)), { weekday: 'short' }),
  );

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('previousMonth')}
            onClick={() => move(-1)}
          >
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('nextMonth')}
            onClick={() => move(1)}
          >
            <ChevronRight className="rtl:rotate-180" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) })
            }
          >
            {t('today')}
          </Button>
        </div>
        <h2 className="text-lg font-semibold capitalize" aria-live="polite">
          {format.dateTime(new Date(Date.UTC(cursor.year, cursor.month - 1, 15, 12)), {
            month: 'long',
            year: 'numeric',
          })}
        </h2>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[44rem] grid-cols-7 overflow-hidden rounded-lg border"
            role="grid"
          >
            {weekdays.map((weekday) => (
              <div
                key={weekday}
                role="columnheader"
                className="bg-muted/60 text-muted-foreground border-b px-2 py-2 text-center text-xs font-medium"
              >
                {weekday}
              </div>
            ))}
            {cells.map((day, index) => {
              const hearings = day ? (byDay.get(day) ?? []) : [];
              return (
                <div
                  key={day ?? `empty-${index}`}
                  role="gridcell"
                  className={cn(
                    'min-h-28 border-e border-b p-1.5 [&:nth-child(7n)]:border-e-0',
                    !day && 'bg-muted/30',
                    day === today && 'bg-accent/40',
                  )}
                >
                  {day && (
                    <>
                      <p
                        className={cn(
                          'mb-1 text-end text-xs tabular-nums',
                          day === today && 'text-navy font-bold',
                        )}
                      >
                        {Number(day.slice(8))}
                      </p>
                      {isLoading ? (
                        <Skeleton className="h-4 w-full" />
                      ) : (
                        <ul className="space-y-1">
                          {hearings.slice(0, 3).map((hearing) => (
                            <li key={hearing.id}>
                              <Link
                                href={`/dashboard/hearings/${hearing.id}`}
                                className={cn(
                                  'block truncate rounded border-s-2 px-1.5 py-0.5 text-[11px] hover:opacity-80',
                                  STATUS_STYLE[hearing.status],
                                )}
                                title={`${hearing.time} · ${hearing.case.referenceNumber} — ${hearing.case.title}`}
                              >
                                <span className="font-semibold tabular-nums">{hearing.time}</span>{' '}
                                {hearing.case.referenceNumber}
                              </Link>
                            </li>
                          ))}
                          {hearings.length > 3 && (
                            <li className="text-muted-foreground px-1.5 text-[11px]">
                              {t('more', { count: hearings.length - 3 })}
                            </li>
                          )}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
