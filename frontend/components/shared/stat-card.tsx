import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = 'navy',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  href?: string;
  tone?: 'navy' | 'gold' | 'danger' | 'success';
}) {
  const tones = {
    navy: 'bg-navy text-white',
    gold: 'bg-gold text-gold-foreground',
    danger: 'bg-red-100 text-red-700',
    success: 'bg-emerald-100 text-emerald-700',
  };
  const content = (
    <Card className={cn('h-full p-5 transition-shadow', href && 'hover:shadow-md')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="text-navy mt-2 text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {hint && <p className="text-muted-foreground mt-1 truncate text-xs">{hint}</p>}
        </div>
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            tones[tone],
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
  return href ? (
    <Link
      href={href}
      className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      {content}
    </Link>
  ) : (
    content
  );
}
