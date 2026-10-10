'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface ListStateDefaults<F extends string> {
  sortBy: string;
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
  filters?: readonly F[];
}

/**
 * Pagination / sorting / search / filters stored in the URL query string,
 * so lists are shareable and survive navigation (back button, links from widgets).
 */
export function useListState<F extends string = never>(defaults: ListStateDefaults<F>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const pageSize = Number(searchParams.get('pageSize') ?? defaults.pageSize ?? 10) || 10;
  const search = searchParams.get('search') ?? '';
  const sortBy = searchParams.get('sortBy') ?? defaults.sortBy;
  const sortOrder =
    (searchParams.get('sortOrder') as 'asc' | 'desc' | null) ?? defaults.sortOrder ?? 'desc';

  const filterKeys = defaults.filters;
  const filters = useMemo(() => {
    const values = {} as Record<F, string | undefined>;
    for (const key of filterKeys ?? []) values[key] = searchParams.get(key) ?? undefined;
    return values;
  }, [searchParams, filterKeys]);

  const update = useCallback(
    (changes: Record<string, string | number | undefined>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '') params.delete(key);
        else params.set(key, String(value));
      }
      if (resetPage && !('page' in changes)) params.delete('page');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return {
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
    filters,
    params: { page, pageSize, search: search || undefined, sortBy, sortOrder },
    setPage: (value: number) => update({ page: value > 1 ? value : undefined }, false),
    setPageSize: (value: number) => update({ pageSize: value }),
    setSearch: (value: string) => update({ search: value }),
    setSort: (key: string) =>
      update({ sortBy: key, sortOrder: sortBy === key && sortOrder === 'desc' ? 'asc' : 'desc' }),
    setFilter: (key: F, value: string | undefined) => update({ [key]: value }),
    reset: () => router.replace(pathname, { scroll: false }),
    hasActiveFilters: Boolean(search) || Object.values(filters).some(Boolean),
  };
}
