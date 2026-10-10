'use client';

import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Receipt, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { RoleGate } from '@/components/auth/role-gate';
import { DataTable, Pagination, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { StatCard } from '@/components/shared/stat-card';
import { InvoiceStatusBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { useFormat } from '@/hooks/use-format';
import { useListState } from '@/hooks/use-list-state';
import { fullName } from '@/lib/utils';
import { invoicesService } from '@/services/resources';
import { INVOICE_STATUSES, type Invoice, type InvoiceStatus } from '@/types/api';

const FILTERS = ['status', 'from', 'to'] as const;

export default function InvoicesPage() {
  const t = useTranslations('invoices');
  const common = useTranslations('common');
  const enums = useTranslations('enums.invoiceStatus');
  const format = useFormat();
  const list = useListState({ sortBy: 'issueDate', filters: FILTERS });
  const { status, from, to } = list.filters;

  const query = useQuery({
    queryKey: ['invoices', 'list', list.params, list.filters],
    queryFn: () =>
      invoicesService.list({
        ...list.params,
        status: status ? [status as InvoiceStatus] : undefined,
        from,
        to,
      }),
    placeholderData: keepPreviousData,
  });
  const meta = query.data?.meta;

  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: t('number'),
      sortKey: 'invoiceNumber',
      cell: (invoice) => (
        <div className="min-w-0">
          <Link
            href={`/dashboard/invoices/${invoice.id}`}
            className="text-navy font-medium hover:underline"
            dir="ltr"
          >
            {invoice.invoiceNumber}
          </Link>
          <p className="text-muted-foreground truncate text-xs">
            {fullName(invoice.client)}
            {invoice.case ? ` · ${invoice.case.referenceNumber}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('status'),
      cell: (invoice) => <InvoiceStatusBadge status={invoice.status} />,
    },
    {
      key: 'issueDate',
      header: t('issueDate'),
      sortKey: 'issueDate',
      hideBelow: 'md',
      cell: (invoice) => format.date(invoice.issueDate),
    },
    {
      key: 'dueDate',
      header: t('dueDate'),
      sortKey: 'dueDate',
      hideBelow: 'sm',
      cell: (invoice) => (
        <span className={invoice.status === 'OVERDUE' ? 'text-destructive font-medium' : undefined}>
          {format.date(invoice.dueDate)}
        </span>
      ),
    },
    {
      key: 'total',
      header: t('total'),
      sortKey: 'total',
      className: 'text-end tabular-nums',
      cell: (invoice) => format.money(invoice.total),
    },
    {
      key: 'balance',
      header: t('balance'),
      hideBelow: 'md',
      className: 'text-end tabular-nums',
      cell: (invoice) =>
        invoice.status === 'CANCELLED' ? (
          '—'
        ) : (
          <span
            className={invoice.balance > 0 ? 'text-destructive font-medium' : 'text-emerald-700'}
          >
            {format.money(invoice.balance)}
          </span>
        ),
    },
  ];

  return (
    <RoleGate roles={['ADMIN', 'LAWYER']}>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button asChild>
            <Link href="/dashboard/invoices/new">
              <Plus /> {t('new')}
            </Link>
          </Button>
        }
      />
      {meta && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label={t('sumTotal')} value={format.money(meta.sumTotal)} icon={Receipt} />
          <StatCard
            label={t('sumPaid')}
            value={format.money(meta.sumPaid)}
            icon={Wallet}
            tone="success"
          />
          <StatCard
            label={t('balance')}
            value={format.money(Math.max(0, meta.sumTotal - meta.sumPaid))}
            icon={Wallet}
            tone={meta.sumTotal - meta.sumPaid > 0 ? 'danger' : 'success'}
          />
        </div>
      )}
      <Card className="gap-0 py-0">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder={t('searchPlaceholder')}
            className="sm:col-span-2 lg:max-w-xs"
          />
          <NativeSelect
            aria-label={t('status')}
            className="lg:w-48"
            value={status ?? ''}
            onChange={(event) => list.setFilter('status', event.target.value || undefined)}
          >
            <option value="">
              {t('status')} — {common('all')}
            </option>
            {INVOICE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {enums(value)}
              </option>
            ))}
          </NativeSelect>
          <label className="text-muted-foreground grid gap-1 text-xs">
            {common('from')}
            <Input
              type="date"
              className="lg:w-40"
              value={from ?? ''}
              onChange={(event) => list.setFilter('from', event.target.value || undefined)}
            />
          </label>
          <label className="text-muted-foreground grid gap-1 text-xs">
            {common('to')}
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
          rowKey={(invoice) => invoice.id}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.setSort}
          rowClassName={(invoice) => (invoice.status === 'OVERDUE' ? 'bg-red-50/40' : undefined)}
          empty={
            list.hasActiveFilters
              ? undefined
              : { title: t('emptyTitle'), description: t('emptyText') }
          }
        />
        <Pagination meta={meta} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />
      </Card>
    </RoleGate>
  );
}
