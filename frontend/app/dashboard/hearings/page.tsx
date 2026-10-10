'use client';

import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, List } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { HearingCalendar } from '@/components/hearings/hearing-calendar';
import { DataTable, Pagination, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { HearingStatusBadge } from '@/components/shared/status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { useFormat } from '@/hooks/use-format';
import { useListState } from '@/hooks/use-list-state';
import { todayInput, zonedDay } from '@/lib/dates';
import { cn, fullName } from '@/lib/utils';
import { hearingsService, type HearingRange } from '@/services/resources';
import { HEARING_STATUSES, type Hearing, type HearingStatus } from '@/types/api';

const FILTERS = ['range', 'status', 'view'] as const;
const RANGES: Array<HearingRange | 'all'> = [
  'all',
  'today',
  'tomorrow',
  'week',
  'upcoming',
  'overdue',
];

export default function HearingsPage() {
  const t = useTranslations('hearings');
  const common = useTranslations('common');
  const enums = useTranslations('enums');
  const format = useFormat();
  const list = useListState({ sortBy: 'date', sortOrder: 'asc', filters: FILTERS });
  const range = list.filters.range as HearingRange | undefined;
  const status = list.filters.status as HearingStatus | undefined;
  const view = list.filters.view === 'calendar' ? 'calendar' : 'list';
  const today = todayInput();

  const query = useQuery({
    queryKey: ['hearings', 'list', list.params, range, status],
    queryFn: () =>
      hearingsService.list({ ...list.params, range, status: status ? [status] : undefined }),
    placeholderData: keepPreviousData,
    enabled: view === 'list',
  });

  const isOverdue = (hearing: Hearing) =>
    hearing.status === 'SCHEDULED' && zonedDay(hearing.date) < today;

  const columns: Column<Hearing>[] = [
    {
      key: 'date',
      header: t('date'),
      sortKey: 'date',
      cell: (hearing) => (
        <Link href={`/dashboard/hearings/${hearing.id}`} className="block hover:underline">
          <span
            className={cn(
              'block font-medium',
              isOverdue(hearing) ? 'text-destructive' : 'text-navy',
            )}
          >
            {format.weekdayShort(hearing.date)}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">{hearing.time}</span>
        </Link>
      ),
    },
    {
      key: 'case',
      header: t('case'),
      cell: (hearing) => (
        <div className="max-w-xs min-w-0">
          <Link
            href={`/dashboard/cases/${hearing.case.id}`}
            className="block truncate font-medium hover:underline"
          >
            {hearing.case.title}
          </Link>
          <p className="text-muted-foreground truncate text-xs">
            {hearing.case.referenceNumber} · {fullName(hearing.case.client)}
          </p>
        </div>
      ),
    },
    {
      key: 'court',
      header: t('court'),
      hideBelow: 'md',
      cell: (hearing) => (
        <span className="text-sm">
          {hearing.court ?? '—'}
          {hearing.location && (
            <span className="text-muted-foreground block text-xs">{hearing.location}</span>
          )}
        </span>
      ),
    },
    {
      key: 'type',
      header: t('type'),
      hideBelow: 'lg',
      cell: (hearing) => enums(`hearingType.${hearing.type}`),
    },
    {
      key: 'status',
      header: t('status'),
      cell: (hearing) =>
        isOverdue(hearing) ? (
          <Badge variant="danger">{t('ranges.overdue')}</Badge>
        ) : (
          <HearingStatusBadge status={hearing.status} />
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button asChild variant="gold">
            <Link href="/dashboard/hearings/new">
              <CalendarPlus /> {t('new')}
            </Link>
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {view === 'list' ? (
              <div
                role="tablist"
                aria-label={t('title')}
                className="bg-muted flex flex-wrap gap-1 rounded-lg p-1"
              >
                {RANGES.map((value) => {
                  const active = (range ?? 'all') === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => list.setFilter('range', value === 'all' ? undefined : value)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground',
                        value === 'overdue' && !active && 'text-destructive/80',
                      )}
                    >
                      {t(`ranges.${value}`)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span />
            )}
            <div
              className="flex gap-1 rounded-lg border p-1"
              role="group"
              aria-label={t('views.list')}
            >
              <Button
                variant={view === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={view === 'list'}
                onClick={() => list.setFilter('view', undefined)}
              >
                <List /> {t('views.list')}
              </Button>
              <Button
                variant={view === 'calendar' ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={view === 'calendar'}
                onClick={() => list.setFilter('view', 'calendar')}
              >
                <CalendarDays /> {t('views.calendar')}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder={t('searchPlaceholder')}
            />
            {view === 'list' && (
              <NativeSelect
                aria-label={t('status')}
                className="sm:w-44"
                value={status ?? ''}
                onChange={(event) => list.setFilter('status', event.target.value || undefined)}
              >
                <option value="">
                  {t('status')} — {common('all')}
                </option>
                {HEARING_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {enums(`hearingStatus.${value}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>
        </div>
        {view === 'calendar' ? (
          <HearingCalendar search={list.search || undefined} />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={query.data?.data}
              rowKey={(hearing) => hearing.id}
              isLoading={query.isLoading}
              error={query.error}
              onRetry={() => query.refetch()}
              sortBy={list.sortBy}
              sortOrder={list.sortOrder}
              onSort={list.setSort}
              rowClassName={(hearing) => (isOverdue(hearing) ? 'bg-red-50/40' : undefined)}
              empty={
                list.hasActiveFilters
                  ? undefined
                  : { title: t('emptyTitle'), description: t('emptyText') }
              }
            />
            <Pagination
              meta={query.data?.meta}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
            />
          </>
        )}
      </Card>
    </div>
  );
}
