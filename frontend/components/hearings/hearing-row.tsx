'use client';

import Link from 'next/link';
import { Clock, Landmark } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { HearingStatusBadge } from '@/components/shared/status-badges';
import { Badge } from '@/components/ui/badge';
import { cn, fullName } from '@/lib/utils';
import type { HearingStatus, HearingType, PersonRef } from '@/types/api';

export interface HearingRowData {
  id: string;
  date: string;
  time: string;
  court: string | null;
  location?: string | null;
  type: HearingType;
  status: HearingStatus;
  case: { id: string; referenceNumber: string; title: string; client: PersonRef };
}

export function HearingRow({
  hearing,
  overdue = false,
  showCase = true,
}: {
  hearing: HearingRowData;
  overdue?: boolean;
  showCase?: boolean;
}) {
  const format = useFormatter();
  const t = useTranslations('hearings');
  const enums = useTranslations('enums.hearingType');
  const date = new Date(hearing.date);

  return (
    <Link
      href={`/dashboard/hearings/${hearing.id}`}
      className={cn(
        'hover:border-gold/60 hover:bg-accent/30 focus-visible:ring-ring flex items-center gap-4 rounded-lg border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none',
        overdue && 'border-red-200 bg-red-50/40',
      )}
    >
      <div
        className={cn(
          'flex w-14 shrink-0 flex-col items-center rounded-md py-1.5 text-center',
          overdue ? 'bg-red-100 text-red-800' : 'bg-navy text-white',
        )}
      >
        <span className="text-[10px] font-medium uppercase opacity-80">
          {format.dateTime(date, { month: 'short' })}
        </span>
        <span className="text-xl leading-none font-semibold tabular-nums">
          {format.dateTime(date, { day: '2-digit' })}
        </span>
        <span className="text-[10px] opacity-80">
          {format.dateTime(date, { weekday: 'short' })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showCase ? (
            <p className="truncate font-medium">
              <span className="text-muted-foreground">{hearing.case.referenceNumber}</span> ·{' '}
              {hearing.case.title}
            </p>
          ) : (
            <p className="font-medium">{enums(hearing.type)}</p>
          )}
        </div>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-foreground inline-flex items-center gap-1 font-medium">
            <Clock className="size-3.5" aria-hidden />
            {hearing.time}
          </span>
          {hearing.court && (
            <span className="inline-flex items-center gap-1">
              <Landmark className="size-3.5" aria-hidden />
              {hearing.court}
              {hearing.location ? ` — ${hearing.location}` : ''}
            </span>
          )}
          {showCase && <span>{fullName(hearing.case.client)}</span>}
          {showCase && <span>{enums(hearing.type)}</span>}
        </div>
      </div>
      <div className="hidden shrink-0 sm:block">
        {overdue ? (
          <Badge variant="danger">{t('overdueBadge')}</Badge>
        ) : (
          <HearingStatusBadge status={hearing.status} />
        )}
      </div>
    </Link>
  );
}
