'use client';

import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { RoleGate } from '@/components/auth/role-gate';
import { ContractExpiry } from '@/components/contracts/contract-expiry';
import { DataTable, Pagination, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { ContractStatusBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useFormat } from '@/hooks/use-format';
import { useListState } from '@/hooks/use-list-state';
import { cn, fullName } from '@/lib/utils';
import { contractsService } from '@/services/resources';
import type { Contract } from '@/types/api';

const FILTERS = ['view'] as const;
const VIEWS = ['all', 'active', 'expiring', 'expired'] as const;
type View = (typeof VIEWS)[number];

export default function ContractsPage() {
  const t = useTranslations('contracts');
  const common = useTranslations('common');
  const format = useFormat();
  const list = useListState({ sortBy: 'endDate', sortOrder: 'asc', filters: FILTERS });
  const view = (list.filters.view as View | undefined) ?? 'all';

  const query = useQuery({
    queryKey: ['contracts', 'list', list.params, view],
    queryFn: () =>
      contractsService.list({ ...list.params, view: view === 'all' ? undefined : view }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<Contract>[] = [
    {
      key: 'title',
      header: t('contractTitle'),
      sortKey: 'title',
      cell: (contract) => (
        <div className="max-w-xs min-w-0">
          <Link
            href={`/dashboard/contracts/${contract.id}`}
            className="text-navy block truncate font-medium hover:underline"
          >
            {contract.title}
          </Link>
          <p className="text-muted-foreground truncate text-xs">
            {fullName(contract.client)}
            {contract.case ? ` · ${contract.case.referenceNumber}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('status'),
      cell: (contract) => <ContractStatusBadge status={contract.status} />,
    },
    {
      key: 'startDate',
      header: t('startDate'),
      sortKey: 'startDate',
      hideBelow: 'md',
      cell: (contract) => format.date(contract.startDate),
    },
    {
      key: 'endDate',
      header: t('endDate'),
      sortKey: 'endDate',
      hideBelow: 'sm',
      cell: (contract) => (
        <div>
          <p>{contract.endDate ? format.date(contract.endDate) : '—'}</p>
          <ContractExpiry contract={contract} />
        </div>
      ),
    },
    {
      key: 'value',
      header: t('value'),
      hideBelow: 'lg',
      className: 'text-end tabular-nums',
      cell: (contract) => (contract.value ? format.money(contract.value) : '—'),
    },
  ];

  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button asChild>
            <Link href="/dashboard/contracts/new">
              <Plus /> {t('new')}
            </Link>
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label={t('title')}
            className="bg-muted flex flex-wrap gap-1 rounded-lg p-1"
          >
            {VIEWS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => list.setFilter('view', value === 'all' ? undefined : value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  view === value
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`views.${value}`)}
              </button>
            ))}
          </div>
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder={t('searchPlaceholder')}
          />
        </div>
        <DataTable
          columns={columns}
          data={query.data?.data}
          rowKey={(contract) => contract.id}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.setSort}
          empty={
            list.hasActiveFilters
              ? { title: common('noResults') }
              : { title: t('emptyTitle'), description: t('emptyText') }
          }
        />
        <Pagination
          meta={query.data?.meta}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      </Card>
    </RoleGate>
  );
}
