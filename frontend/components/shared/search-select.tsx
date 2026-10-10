'use client';

import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchSelectProps {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string | null, option: SelectOption | null) => void;
  /** Server-side search: options are fetched for the typed text. */
  loadOptions: (search: string) => Promise<SelectOption[]>;
  queryKey: string;
  selectedLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/** Accessible combobox for picking a client / case / user among potentially many records. */
export function SearchSelect({
  id,
  value,
  onChange,
  loadOptions,
  queryKey,
  selectedLabel,
  placeholder,
  disabled,
  clearable = false,
  ...aria
}: SearchSelectProps) {
  const t = useTranslations('common');
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const [label, setLabel] = useState(selectedLabel ?? '');
  const search = useDebouncedValue(term, 250);

  useEffect(() => {
    if (selectedLabel) setLabel(selectedLabel);
  }, [selectedLabel]);

  const { data: options = [], isFetching } = useQuery({
    queryKey: ['search-select', queryKey, search],
    queryFn: () => loadOptions(search),
    enabled: open && !disabled,
  });

  const select = (option: SelectOption | null) => {
    setLabel(option?.label ?? '');
    onChange(option?.value ?? null, option);
    setOpen(false);
    setTerm('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-invalid={aria['aria-invalid']}
            aria-describedby={aria['aria-describedby']}
            className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 aria-invalid:border-destructive flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-start text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={cn('truncate', !value && 'text-muted-foreground')}>
              {value && label ? label : (placeholder ?? t('select'))}
            </span>
            <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </button>
        </PopoverTrigger>
        {clearable && value && !disabled && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground absolute end-8 top-1/2 -translate-y-1/2 rounded p-1"
            aria-label={t('clear')}
            onClick={() => select(null)}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-1">
        <Input
          autoFocus
          value={term}
          placeholder={t('searchSelectPlaceholder')}
          aria-label={t('search')}
          aria-controls={listId}
          className="mb-1 h-8"
          onChange={(event) => {
            setTerm(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, options.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (options[active]) select(options[active]);
            }
          }}
        />
        <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto">
          {isFetching && options.length === 0 && (
            <li className="flex justify-center py-4">
              <Loader2
                className="text-muted-foreground size-4 animate-spin"
                aria-label={t('loading')}
              />
            </li>
          )}
          {!isFetching && options.length === 0 && (
            <li className="text-muted-foreground px-3 py-4 text-center text-sm">
              {t('noResults')}
            </li>
          )}
          {options.map((option, index) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm',
                  index === active && 'bg-secondary',
                )}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(option)}
              >
                <Check
                  className={cn(
                    'size-4 shrink-0',
                    option.value === value ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.description && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {option.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
