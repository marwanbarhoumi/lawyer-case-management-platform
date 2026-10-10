'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SEGMENT_LABELS } from '@/lib/navigation';

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const common = useTranslations('common');
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const parent = segments[index - 1];
    let label: string;
    if (segment === 'settings' && parent === 'admin') label = t('systemSettings');
    else if (SEGMENT_LABELS[segment]) label = t(SEGMENT_LABELS[segment]);
    else label = common('details');
    return { href, label, linkable: segment !== 'admin' };
  });

  return (
    <nav aria-label={common('breadcrumb')} className="min-w-0">
      <ol className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" aria-hidden />
              )}
              {last || !crumb.linkable ? (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={last ? 'text-foreground truncate font-medium' : 'truncate'}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-foreground truncate">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
