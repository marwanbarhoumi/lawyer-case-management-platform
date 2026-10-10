'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCurrentUser } from '@/components/providers/auth-provider';
import { isActivePath, visibleGroups } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const user = useCurrentUser();

  return (
    <nav aria-label={t('workspace')} className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {visibleGroups(user.role).map((group) => (
        <div key={group.key}>
          <p className="text-sidebar-foreground/50 mb-2 px-3 text-[11px] font-semibold tracking-wider uppercase">
            {t(group.key)}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group focus-visible:ring-gold relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      active
                        ? 'bg-sidebar-accent text-white'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white',
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="bg-gold absolute inset-y-1.5 start-0 w-0.5 rounded-full"
                      />
                    )}
                    <Icon
                      className={cn('size-4', active ? 'text-gold' : 'text-sidebar-foreground/70')}
                      aria-hidden
                    />
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
