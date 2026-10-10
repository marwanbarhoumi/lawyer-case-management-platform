'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DocumentUploadDialog } from '@/components/documents/document-upload-dialog';
import { DocumentsTable } from '@/components/documents/documents-table';
import { Pagination } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { useListState } from '@/hooks/use-list-state';
import { documentsService } from '@/services/resources';
import { DOCUMENT_TYPES, type DocumentType } from '@/types/api';

const FILTERS = ['type', 'caseId', 'clientId'] as const;

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const common = useTranslations('common');
  const enums = useTranslations('enums.documentType');
  const list = useListState({ sortBy: 'createdAt', filters: FILTERS });
  const type = list.filters.type as DocumentType | undefined;

  const query = useQuery({
    queryKey: ['documents', 'list', list.params, list.filters],
    queryFn: () =>
      documentsService.list({
        ...list.params,
        type: type ? [type] : undefined,
        caseId: list.filters.caseId,
        clientId: list.filters.clientId,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={<DocumentUploadDialog />}
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder={t('searchPlaceholder')}
          />
          <NativeSelect
            aria-label={t('category')}
            className="sm:w-48"
            value={type ?? ''}
            onChange={(event) => list.setFilter('type', event.target.value || undefined)}
          >
            <option value="">
              {t('category')} — {common('all')}
            </option>
            {DOCUMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {enums(value)}
              </option>
            ))}
          </NativeSelect>
          {list.hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={list.reset}>
              {common('reset')}
            </Button>
          )}
        </div>
        <DocumentsTable
          data={query.data?.data}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.setSort}
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
      </Card>
    </div>
  );
}
