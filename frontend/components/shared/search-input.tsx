'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

/** Debounced search box: updates the parent (and the server query) after typing stops. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  delay = 350,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  delay?: number;
}) {
  const t = useTranslations('common');
  const [local, setLocal] = useState(value);
  const debounced = useDebouncedValue(local, delay);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (debounced.trim() !== value) onChange(debounced.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced value
  }, [debounced]);

  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        type="search"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        placeholder={placeholder ?? t('search')}
        aria-label={placeholder ?? t('search')}
        className="ps-9 pe-8"
      />
      {local && (
        <button
          type="button"
          onClick={() => setLocal('')}
          className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2 rounded p-1"
          aria-label={t('clear')}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
