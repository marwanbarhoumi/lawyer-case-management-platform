'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarPlus, Plus, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DocumentUploadDialog } from '@/components/documents/document-upload-dialog';
import { DocumentsTable } from '@/components/documents/documents-table';
import { HearingRow } from '@/components/hearings/hearing-row';
import { DataTable, Pagination, type Column } from '@/components/shared/data-table';
import { EmptyState, ErrorState } from '@/components/shared/states';
import {
  CaseStatusBadge,
  ContractStatusBadge,
  InvoiceStatusBadge,
  PriorityBadge,
} from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormat } from '@/hooks/use-format';
import { todayInput, zonedDay } from '@/lib/dates';
import {
  casesService,
  contractsService,
  documentsService,
  hearingsService,
  invoicesService,
} from '@/services/resources';
import type { CaseListItem, Contract, Invoice } from '@/types/api';

interface Scope {
  caseId?: string;
  clientId?: string;
}

function PanelToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-b px-4 py-3">
      {children}
    </div>
  );
}

export function CasesPanel({ clientId, canCreate }: { clientId: string; canCreate: boolean }) {
  const t = useTranslations('cases');
  const common = useTranslations('common');
  const format = useFormat();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['cases', 'panel', clientId, page],
    queryFn: () =>
      casesService.list({ clientId, page, pageSize: 10, sortBy: 'updatedAt', sortOrder: 'desc' }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<CaseListItem>[] = [
    {
      key: 'title',
      header: t('caseTitle'),
      cell: (item) => (
        <div>
          <Link
            href={`/dashboard/cases/${item.id}`}
            className="text-navy font-medium hover:underline"
          >
            {item.title}
          </Link>
          <p className="text-muted-foreground text-xs">{item.referenceNumber}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: common('status'),
      cell: (item) => <CaseStatusBadge status={item.status} />,
    },
    {
      key: 'priority',
      header: t('priority'),
      hideBelow: 'sm',
      cell: (item) => <PriorityBadge priority={item.priority} />,
    },
    {
      key: 'next',
      header: t('nextHearing'),
      hideBelow: 'md',
      cell: (item) =>
        item.nextHearing ? (
          `${format.date(item.nextHearing.date)} · ${item.nextHearing.time}`
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div>
      {canCreate && (
        <PanelToolbar>
          <Button asChild size="sm">
            <Link href={`/dashboard/cases/new?clientId=${clientId}`}>
              <Plus /> {t('new')}
            </Link>
          </Button>
        </PanelToolbar>
      )}
      <DataTable
        columns={columns}
        data={query.data?.data}
        rowKey={(item) => item.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        empty={{ title: t('emptyTitle') }}
      />
      <Pagination meta={query.data?.meta} onPageChange={setPage} />
    </div>
  );
}

export function HearingsPanel({ caseId, clientId, canCreate }: Scope & { canCreate: boolean }) {
  const t = useTranslations('hearings');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['hearings', 'panel', caseId, clientId, page],
    queryFn: () =>
      hearingsService.list({
        caseId,
        clientId,
        page,
        pageSize: 10,
        sortBy: 'date',
        sortOrder: 'desc',
      }),
    placeholderData: keepPreviousData,
  });
  const today = todayInput();

  return (
    <div>
      {canCreate && caseId && (
        <PanelToolbar>
          <Button asChild size="sm">
            <Link href={`/dashboard/hearings/new?caseId=${caseId}`}>
              <CalendarPlus /> {t('new')}
            </Link>
          </Button>
        </PanelToolbar>
      )}
      <div className="space-y-2 p-4">
        {query.isLoading &&
          Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
        {query.error !== null && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
        {query.data?.data.length === 0 && <EmptyState title={t('emptyTitle')} />}
        {query.data?.data.map((hearing) => (
          <HearingRow
            key={hearing.id}
            hearing={hearing}
            showCase={!caseId}
            overdue={hearing.status === 'SCHEDULED' && zonedDay(hearing.date) < today}
          />
        ))}
      </div>
      <Pagination meta={query.data?.meta} onPageChange={setPage} />
    </div>
  );
}

export function DocumentsPanel({ caseId, clientId }: Scope) {
  const t = useTranslations('documents');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ sortBy: string; sortOrder: 'asc' | 'desc' }>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const query = useQuery({
    queryKey: ['documents', 'panel', caseId, clientId, page, sort],
    queryFn: () => documentsService.list({ caseId, clientId, page, pageSize: 10, ...sort }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PanelToolbar>
        <DocumentUploadDialog
          caseId={caseId}
          clientId={caseId ? undefined : clientId}
          trigger={
            <Button size="sm">
              <Upload /> {t('upload')}
            </Button>
          }
        />
      </PanelToolbar>
      <DocumentsTable
        data={query.data?.data}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        sortBy={sort.sortBy}
        sortOrder={sort.sortOrder}
        onSort={(key) =>
          setSort((current) => ({
            sortBy: key,
            sortOrder: current.sortBy === key && current.sortOrder === 'desc' ? 'asc' : 'desc',
          }))
        }
        showLink={!caseId}
        empty={{ title: t('emptyTitle'), description: t('emptyText') }}
      />
      <Pagination meta={query.data?.meta} onPageChange={setPage} />
    </div>
  );
}

export function ContractsPanel({ caseId, clientId }: Scope) {
  const t = useTranslations('contracts');
  const common = useTranslations('common');
  const format = useFormat();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['contracts', 'panel', caseId, clientId, page],
    queryFn: () =>
      contractsService.list({
        caseId,
        clientId,
        page,
        pageSize: 10,
        sortBy: 'startDate',
        sortOrder: 'desc',
      }),
    placeholderData: keepPreviousData,
  });
  const params = new URLSearchParams();
  if (clientId) params.set('clientId', clientId);
  if (caseId) params.set('caseId', caseId);

  const columns: Column<Contract>[] = [
    {
      key: 'title',
      header: t('contractTitle'),
      cell: (contract) => (
        <Link
          href={`/dashboard/contracts/${contract.id}`}
          className="text-navy font-medium hover:underline"
        >
          {contract.title}
        </Link>
      ),
    },
    {
      key: 'status',
      header: common('status'),
      cell: (contract) => <ContractStatusBadge status={contract.status} />,
    },
    {
      key: 'period',
      header: `${t('startDate')} – ${t('endDate')}`,
      hideBelow: 'sm',
      cell: (contract) =>
        `${format.date(contract.startDate)} – ${contract.endDate ? format.date(contract.endDate) : t('noEndDate')}`,
    },
    {
      key: 'value',
      header: t('value'),
      hideBelow: 'md',
      className: 'text-end tabular-nums',
      cell: (contract) => (contract.value ? format.money(contract.value) : '—'),
    },
  ];

  return (
    <div>
      <PanelToolbar>
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/contracts/new?${params.toString()}`}>
            <Plus /> {t('new')}
          </Link>
        </Button>
      </PanelToolbar>
      <DataTable
        columns={columns}
        data={query.data?.data}
        rowKey={(contract) => contract.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        empty={{ title: t('emptyTitle') }}
      />
      <Pagination meta={query.data?.meta} onPageChange={setPage} />
    </div>
  );
}

export function InvoicesPanel({ caseId, clientId }: Scope) {
  const t = useTranslations('invoices');
  const common = useTranslations('common');
  const format = useFormat();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['invoices', 'panel', caseId, clientId, page],
    queryFn: () =>
      invoicesService.list({
        caseId,
        clientId,
        page,
        pageSize: 10,
        sortBy: 'issueDate',
        sortOrder: 'desc',
      }),
    placeholderData: keepPreviousData,
  });
  const params = new URLSearchParams();
  if (clientId) params.set('clientId', clientId);
  if (caseId) params.set('caseId', caseId);

  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: t('number'),
      cell: (invoice) => (
        <Link
          href={`/dashboard/invoices/${invoice.id}`}
          className="text-navy font-medium hover:underline"
        >
          {invoice.invoiceNumber}
        </Link>
      ),
    },
    {
      key: 'status',
      header: common('status'),
      cell: (invoice) => <InvoiceStatusBadge status={invoice.status} />,
    },
    {
      key: 'due',
      header: t('dueDate'),
      hideBelow: 'sm',
      cell: (invoice) => format.date(invoice.dueDate),
    },
    {
      key: 'total',
      header: t('total'),
      className: 'text-end tabular-nums',
      cell: (invoice) => format.money(invoice.total),
    },
    {
      key: 'balance',
      header: t('balance'),
      hideBelow: 'md',
      className: 'text-end tabular-nums',
      cell: (invoice) => (
        <span
          className={
            invoice.balance > 0 && invoice.status !== 'CANCELLED'
              ? 'text-destructive font-medium'
              : ''
          }
        >
          {format.money(invoice.status === 'CANCELLED' ? 0 : invoice.balance)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PanelToolbar>
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/invoices/new?${params.toString()}`}>
            <Plus /> {t('new')}
          </Link>
        </Button>
      </PanelToolbar>
      <DataTable
        columns={columns}
        data={query.data?.data}
        rowKey={(invoice) => invoice.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        empty={{ title: t('emptyTitle') }}
      />
      <Pagination meta={query.data?.meta} onPageChange={setPage} />
    </div>
  );
}
