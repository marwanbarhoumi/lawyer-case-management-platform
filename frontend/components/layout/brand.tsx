import { Scale } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export function Brand({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const t = useTranslations('common');
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-lg ring-1',
          inverted ? 'bg-gold/15 text-gold ring-gold/30' : 'bg-navy text-gold ring-navy/10',
        )}
      >
        <Scale className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-xl font-bold tracking-wide',
            inverted ? 'text-white' : 'text-navy',
          )}
        >
          {t('appName')}
        </span>
        <span
          className={cn(
            'mt-0.5 text-[11px]',
            inverted ? 'text-sidebar-foreground/70' : 'text-muted-foreground',
          )}
        >
          {t('appTagline')}
        </span>
      </span>
    </span>
  );
}
