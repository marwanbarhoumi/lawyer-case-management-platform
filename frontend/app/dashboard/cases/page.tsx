'use client';

import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarClock, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/providers/auth-provider';
import { DataTable, Pagination, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { CaseStatusBadge, PriorityBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { useFormat } from '@/hooks/use-format';
import { useListState } from '@/hooks/use-list-state';
import { fullName } from '@/lib/utils';
import { casesService } from '@/services/resources';
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_TYPES,
  type CaseListItem,
  type CasePriority,
  type CaseStatus,
  type CaseType,
} from '@/types/api';

const FILTERS = ['status', 'priority', 'caseType', 'from', 'to'] as const;

export default function CasesPage() {
  const t = useTranslations('cases');
  const common = useTranslations('common');
  const enums = useTranslations('enums');
  const { hasRole } = useAuth();
  const format = useFormat();
  const list = useListState({ sortBy: 'updatedAt', filters: FILTERS });
  const canManage = hasRole('ADMIN', 'LAWYER');
  const { status, priority, caseType, from, to } = list.filters;

  const query = useQuery({
    queryKey: ['cases', 'list', list.params, list.filters],
    queryFn: () =>
      casesService.list({
        ...list.params,
        status: status ? [status as CaseStatus] : undefined,
        priority: priority ? [priority as CasePriority] : undefined,
        caseType: caseType ? [caseType as CaseType] : undefined,
        from,
        to,
      }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<CaseListItem>[] = [
    {
      key: 'reference',
      header: t('reference'),
      sortKey: 'referenceNumber',
      hideBelow: 'md',
      cell: (item) => (
        <span className="font-mono text-xs" dir="ltr">
          {item.referenceNumber}
        </span>
      ),
    },
    {
      key: 'title',
      header: t('caseTitle'),
      sortKey: 'title',
      cell: (item) => (
        <div className="max-w-xs min-w-0">
          <Link
            href={`/dashboard/cases/${item.id}`}
            className="text-navy block truncate font-medium hover:underline"
          >
            {item.title}
          </Link>
          <p className="text-muted-foreground truncate text-xs">
            {fullName(item.client)} · {enums(`caseType.${item.caseType}`)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('status'),
      sortKey: 'status',
      cell: (item) => <CaseStatusBadge status={item.status} />,
    },
    {
      key: 'priority',
      header: t('priority'),
      sortKey: 'priority',
      hideBelow: 'sm',
      cell: (item) => <PriorityBadge priority={item.priority} />,
    },
    {
      key: 'nextHearing',
      header: t('nextHearing'),
      hideBelow: 'lg',
      cell: (item) =>
        item.nextHearing ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <CalendarClock className="text-gold size-3.5" aria-hidden />
            {format.date(item.nextHearing.date)} · {item.nextHearing.time}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">{t('noNextHearing')}</span>
        ),
    },
    { key: 'lawyer', header: t('lawyer'), hideBelow: 'lg', cell: (item) => fullName(item.lawyer) },
    {
      key: 'openingDate',
      header: t('openingDate'),
      sortKey: 'openingDate',
      hideBelow: 'md',
      cell: (item) => format.date(item.openingDate),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canManage && (
            <Button asChild>
              <Link href="/dashboard/cases/new">
                <Plus /> {t('new')}
              </Link>
            </Button>
          )
        }
      />
      <Card className="gap-0 py-0">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder={t('searchPlaceholder')}
            className="sm:col-span-2 lg:max-w-xs"
          />
          <NativeSelect
            aria-label={t('filterStatus')}
            className="lg:w-40"
            value={status ?? ''}
            onChange={(event) => list.setFilter('status', event.target.value || undefined)}
          >
            <option value="">
              {t('filterStatus')} — {common('all')}
            </option>
            {CASE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {enums(`caseStatus.${value}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label={t('filterPriority')}
            className="lg:w-40"
            value={priority ?? ''}
            onChange={(event) => list.setFilter('priority', event.target.value || undefined)}
          >
            <option value="">
              {t('filterPriority')} — {common('all')}
            </option>
            {CASE_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {enums(`casePriority.${value}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label={t('filterType')}
            className="lg:w-40"
            value={caseType ?? ''}
            onChange={(event) => list.setFilter('caseType', event.target.value || undefined)}
          >
            <option value="">
              {t('filterType')} — {common('all')}
            </option>
            {CASE_TYPES.map((value) => (
              <option key={value} value={value}>
                {enums(`caseType.${value}`)}
              </option>
            ))}
          </NativeSelect>
          <label className="text-muted-foreground grid gap-1 text-xs">
            {t('openedFrom')}
            <Input
              type="date"
              className="lg:w-40"
              value={from ?? ''}
              onChange={(event) => list.setFilter('from', event.target.value || undefined)}
            />
          </label>
          <label className="text-muted-foreground grid gap-1 text-xs">
            {t('openedTo')}
            <Input
              type="date"
              className="lg:w-40"
              value={to ?? ''}
              onChange={(event) => list.setFilter('to', event.target.value || undefined)}
            />
          </label>
          {list.hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={list.reset}>
              {common('reset')}
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          data={query.data?.data}
          rowKey={(item) => item.id}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.setSort}
          rowClassName={(item) =>
            item.priority === 'URGENT' && item.status !== 'CLOSED' ? 'bg-red-50/40' : undefined
          }
          empty={
            list.hasActiveFilters
              ? undefined
              : {
                  title: t('emptyTitle'),
                  description: t('emptyText'),
                  action: canManage && (
                    <Button asChild size="sm">
                      <Link href="/dashboard/cases/new">
                        <Plus /> {t('new')}
                      </Link>
                    </Button>
                  ),
                }
          }
        />
        <Pagination
          meta={query.data?.meta}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      </Card>
    </div>
  );
}
