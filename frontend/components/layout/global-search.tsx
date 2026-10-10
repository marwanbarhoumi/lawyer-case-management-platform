'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Receipt, Search, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/providers/auth-provider';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { fullName } from '@/lib/utils';
import { casesService, clientsService, invoicesService } from '@/services/resources';

interface SearchResult {
  id: string;
  group: 'clients' | 'cases' | 'invoices';
  label: string;
  sublabel: string;
  href: string;
}

const ICONS = { clients: Users, cases: FolderKanban, invoices: Receipt };

/** Searches clients, cases and invoices at once (server-side search, scoped by role). */
export function GlobalSearch() {
  const t = useTranslations('common');
  const nav = useTranslations('nav');
  const { hasRole } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const search = useDebouncedValue(term.trim(), 300);
  const canSeeInvoices = hasRole('ADMIN', 'LAWYER');

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', search, canSeeInvoices],
    enabled: search.length >= 2,
    queryFn: async (): Promise<SearchResult[]> => {
      const [clients, cases, invoices] = await Promise.all([
        clientsService.list({ search, pageSize: 4 }),
        casesService.list({ search, pageSize: 4 }),
        canSeeInvoices ? invoicesService.list({ search, pageSize: 3 }) : Promise.resolve(null),
      ]);
      return [
        ...clients.data.map((client) => ({
          id: client.id,
          group: 'clients' as const,
          label: fullName(client),
          sublabel: client.phone ?? client.email ?? '',
          href: `/dashboard/clients/${client.id}`,
        })),
        ...cases.data.map((item) => ({
          id: item.id,
          group: 'cases' as const,
          label: item.title,
          sublabel: `${item.referenceNumber} · ${fullName(item.client)}`,
          href: `/dashboard/cases/${item.id}`,
        })),
        ...(invoices?.data ?? []).map((invoice) => ({
          id: invoice.id,
          group: 'invoices' as const,
          label: invoice.invoiceNumber,
          sublabel: fullName(invoice.client),
          href: `/dashboard/invoices/${invoice.id}`,
        })),
      ];
    },
  });
  const results = useMemo(() => (search.length >= 2 ? (data ?? []) : []), [data, search]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (result: SearchResult) => {
    setOpen(false);
    setTerm('');
    router.push(result.href);
  };

  return (
    <Popover open={open && search.length >= 2} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-md">
          <Search
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={open && search.length >= 2}
            aria-controls="global-search-results"
            aria-label={t('search')}
            placeholder={`${t('search')}…  (Ctrl+K)`}
            className="ps-9"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, results.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter' && results[active]) {
                event.preventDefault();
                go(results[active]);
              } else if (event.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-72 p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <ul id="global-search-results" role="listbox" aria-label={t('search')}>
          {results.length === 0 && (
            <li className="text-muted-foreground px-3 py-6 text-center text-sm">
              {isFetching ? t('loading') : t('noResults')}
            </li>
          )}
          {results.map((result, index) => {
            const Icon = ICONS[result.group];
            const showGroup = index === 0 || results[index - 1].group !== result.group;
            return (
              <li
                key={`${result.group}-${result.id}`}
                role="option"
                aria-selected={index === active}
              >
                {showGroup && (
                  <p className="text-muted-foreground px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                    {nav(result.group)}
                  </p>
                )}
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm ${index === active ? 'bg-secondary' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(result)}
                >
                  <Icon className="text-muted-foreground size-4" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{result.label}</span>
                    {result.sublabel && (
                      <span className="text-muted-foreground block truncate text-xs">
                        {result.sublabel}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
