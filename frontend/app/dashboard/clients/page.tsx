'use client';

import Link from 'next/link';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, Pagination, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { SearchSelect } from '@/components/shared/search-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { useErrorToast } from '@/hooks/use-error-message';
import { useFormat } from '@/hooks/use-format';
import { useListState } from '@/hooks/use-list-state';
import { userOptionsLoader } from '@/lib/option-loaders';
import { fullName } from '@/lib/utils';
import { clientsService } from '@/services/resources';
import type { Client } from '@/types/api';

const FILTERS = ['archived', 'lawyerId'] as const;
const loadLawyers = userOptionsLoader(['LAWYER', 'ADMIN']);

export default function ClientsPage() {
  const t = useTranslations('clients');
  const common = useTranslations('common');
  const { hasRole } = useAuth();
  const format = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const list = useListState({ sortBy: 'createdAt', filters: FILTERS });
  const canManage = hasRole('ADMIN', 'LAWYER');
  const archived = (list.filters.archived as 'true' | 'false' | 'all' | undefined) ?? 'false';

  const query = useQuery({
    queryKey: ['clients', 'list', list.params, archived, list.filters.lawyerId],
    queryFn: () =>
      clientsService.list({ ...list.params, archived, lawyerId: list.filters.lawyerId }),
    placeholderData: keepPreviousData,
  });

  const toggleArchive = useMutation({
    mutationFn: async (client: Client): Promise<unknown> =>
      client.isArchived ? clientsService.restore(client.id) : clientsService.archive(client.id),
    onSuccess: (_result, client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(client.isArchived ? t('restored') : t('archived'));
    },
    onError: showError,
  });

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: common('name'),
      sortKey: 'lastName',
      cell: (client) => (
        <div className="min-w-0">
          <Link
            href={`/dashboard/clients/${client.id}`}
            className="text-navy font-medium hover:underline"
          >
            {fullName(client)}
          </Link>
          {client.isArchived && (
            <Badge variant="muted" className="ms-2">
              {t('archivedBadge')}
            </Badge>
          )}
          {client.email && (
            <p className="text-muted-foreground truncate text-xs" dir="ltr">
              {client.email}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      header: common('phone'),
      hideBelow: 'sm',
      cell: (client) => <span dir="ltr">{client.phone ?? '—'}</span>,
    },
    {
      key: 'lawyer',
      header: t('lawyer'),
      hideBelow: 'lg',
      cell: (client) =>
        client.lawyer ? (
          fullName(client.lawyer)
        ) : (
          <span className="text-muted-foreground">{t('noLawyer')}</span>
        ),
    },
    {
      key: 'cases',
      header: t('casesCount'),
      hideBelow: 'md',
      cell: (client) => <span className="tabular-nums">{client._count.cases}</span>,
    },
    {
      key: 'createdAt',
      header: common('createdAt'),
      sortKey: 'createdAt',
      hideBelow: 'md',
      cell: (client) => format.date(client.createdAt),
    },
  ];

  if (canManage) {
    columns.push({
      key: 'actions',
      header: common('actions'),
      className: 'w-24 text-end',
      cell: (client) => (
        <div className="flex justify-end gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label={`${common('edit')} — ${fullName(client)}`}
          >
            <Link href={`/dashboard/clients/${client.id}/edit`}>
              <Pencil />
            </Link>
          </Button>
          {client.isArchived ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${t('restore')} — ${fullName(client)}`}
              onClick={() => toggleArchive.mutate(client)}
            >
              <ArchiveRestore />
            </Button>
          ) : (
            <ConfirmDialog
              title={t('archiveTitle')}
              description={t('archiveDescription')}
              confirmLabel={t('archive')}
              onConfirm={() => toggleArchive.mutateAsync(client)}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${t('archive')} — ${fullName(client)}`}
                >
                  <Archive />
                </Button>
              }
            />
          )}
        </div>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canManage && (
            <Button asChild>
              <Link href="/dashboard/clients/new">
                <Plus /> {t('new')}
              </Link>
            </Button>
          )
        }
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder={t('searchPlaceholder')}
          />
          <NativeSelect
            aria-label={common('status')}
            className="sm:w-40"
            value={archived}
            onChange={(event) =>
              list.setFilter(
                'archived',
                event.target.value === 'false' ? undefined : event.target.value,
              )
            }
          >
            <option value="false">{t('filterActive')}</option>
            <option value="true">{t('filterArchived')}</option>
            <option value="all">{common('all')}</option>
          </NativeSelect>
          {hasRole('ADMIN') && (
            <div className="sm:w-56">
              <SearchSelect
                queryKey="lawyers"
                value={list.filters.lawyerId}
                onChange={(value) => list.setFilter('lawyerId', value ?? undefined)}
                loadOptions={loadLawyers}
                placeholder={t('lawyer')}
                clearable
              />
            </div>
          )}
          {list.hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={list.reset}>
              {common('reset')}
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          data={query.data?.data}
          rowKey={(client) => client.id}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.setSort}
          empty={
            list.hasActiveFilters
              ? undefined
              : {
                  title: t('emptyTitle'),
                  description: t('emptyText'),
                  action: canManage && (
                    <Button asChild size="sm">
                      <Link href="/dashboard/clients/new">
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
