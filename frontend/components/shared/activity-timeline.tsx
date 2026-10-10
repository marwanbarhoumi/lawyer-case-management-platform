'use client';

import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useFormat } from '@/hooks/use-format';
import { fullName, initials } from '@/lib/utils';
import { CASE_STATUSES, type ActivityEntry, type CaseStatus } from '@/types/api';
import { EmptyState } from './states';

export function useActivityText() {
  const t = useTranslations('activity');
  const enums = useTranslations('enums.caseStatus');
  const format = useFormat();

  return (entry: ActivityEntry): string => {
    const meta = entry.metadata ?? {};
    const text = (key: string) =>
      typeof meta[key] === 'string' || typeof meta[key] === 'number' ? String(meta[key]) : '';
    const key = entry.action.replace('.', '_');
    const to = text('to');
    const dateSource = entry.action === 'hearing.rescheduled' ? to : text('date');
    const params = {
      name: text('name'),
      reference: text('referenceNumber'),
      title: text('title'),
      invoiceNumber: text('invoiceNumber'),
      date: dateSource ? format.date(dateSource) : '',
      to: (CASE_STATUSES as readonly string[]).includes(to) ? enums(to as CaseStatus) : to,
    };
    return t.has(key as 'unknown') ? t(key as 'unknown', params) : t('unknown');
  };
}

export function ActivityTimeline({
  entries,
  compact = false,
}: {
  entries: ActivityEntry[];
  compact?: boolean;
}) {
  const common = useTranslations('common');
  const dashboard = useTranslations('dashboard');
  const format = useFormat();
  const describe = useActivityText();

  if (entries.length === 0) return <EmptyState title={dashboard('noActivity')} className="py-8" />;

  return (
    <ol className="relative space-y-4">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-3">
          {index < entries.length - 1 && (
            <span
              aria-hidden
              className="bg-border absolute start-4 top-9 -bottom-4 w-px -translate-x-1/2 rtl:translate-x-1/2"
            />
          )}
          <Avatar className="size-8 text-[11px]">
            <AvatarFallback>{entry.user ? initials(entry.user) : '⚙'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className={compact ? 'text-sm' : 'text-sm leading-relaxed'}>
              <span className="font-medium">
                {entry.user ? fullName(entry.user) : common('unknownUser')}
              </span>{' '}
              <span className="text-muted-foreground">{describe(entry)}</span>
            </p>
            <time
              dateTime={entry.createdAt}
              className="text-muted-foreground text-xs"
              title={format.dateTime(entry.createdAt)}
            >
              {format.relative(entry.createdAt)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
