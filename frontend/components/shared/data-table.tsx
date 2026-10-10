'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { PaginationMeta } from '@/types/api';
import { EmptyState, ErrorState } from './states';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortKey?: string;
  className?: string;
  /** Hide the column below this breakpoint to keep tables readable on mobile. */
  hideBelow?: 'sm' | 'md' | 'lg';
}

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  empty?: { title: string; description?: string; action?: React.ReactNode };
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading,
  error,
  onRetry,
  sortBy,
  sortOrder,
  onSort,
  empty,
  rowClassName,
}: DataTableProps<T>) {
  const t = useTranslations('common');

  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => {
            const sorted = column.sortKey && sortBy === column.sortKey;
            const SortIcon = sorted ? (sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
            return (
              <TableHead
                key={column.key}
                className={cn(column.hideBelow && HIDE[column.hideBelow], column.className)}
                aria-sort={sorted ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {column.sortKey && onSort ? (
                  <button
                    type="button"
                    className="hover:text-foreground focus-visible:ring-ring -mx-1 inline-flex items-center gap-1 rounded px-1 uppercase focus-visible:ring-2 focus-visible:outline-none"
                    onClick={() => onSort(column.sortKey as string)}
                  >
                    {column.header}
                    <SortIcon className={cn('size-3', !sorted && 'opacity-40')} aria-hidden />
                  </button>
                ) : (
                  column.header
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading &&
          Array.from({ length: 5 }, (_, index) => (
            <TableRow key={`skeleton-${index}`}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(column.hideBelow && HIDE[column.hideBelow])}
                >
                  <Skeleton className="h-4 w-full max-w-40" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        {!isLoading && data?.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length}>
              <EmptyState
                title={empty?.title ?? t('noResults')}
                description={empty?.description ?? t('noResultsHint')}
                action={empty?.action}
              />
            </TableCell>
          </TableRow>
        )}
        {!isLoading &&
          data?.map((row) => (
            <TableRow key={rowKey(row)} className={rowClassName?.(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(column.hideBelow && HIDE[column.hideBelow], column.className)}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}

export function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
}: {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const t = useTranslations('common');
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <nav
      aria-label={t('pageOf', { page: meta.page, totalPages: meta.totalPages })}
      className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-muted-foreground" aria-live="polite">
        {t('showing', { from, to, total: meta.total })}
      </p>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="text-muted-foreground flex items-center gap-2">
            <span className="hidden sm:inline">{t('rowsPerPage')}</span>
            <NativeSelect
              className="h-8 w-20"
              value={meta.pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <span className="text-muted-foreground">
          {t('pageOf', { page: meta.page, totalPages: meta.totalPages })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('previous')}
            disabled={meta.page <= 1}
            onClick={() => onPageChange(meta.page - 1)}
          >
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('next')}
            disabled={meta.page >= meta.totalPages}
            onClick={() => onPageChange(meta.page + 1)}
          >
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
