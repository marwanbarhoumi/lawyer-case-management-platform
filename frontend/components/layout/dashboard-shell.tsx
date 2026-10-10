'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTitle, SheetContent } from '@/components/ui/dialog';
import { Brand } from './brand';
import { Breadcrumbs } from './breadcrumbs';
import { GlobalSearch } from './global-search';
import { LanguageSwitcher } from './language-switcher';
import { NotificationBell } from './notification-bell';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="bg-gold text-gold-foreground sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t('skipToContent')}
      </a>

      <aside className="no-print border-sidebar-border bg-sidebar sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e lg:flex">
        <Link
          href="/dashboard"
          className="border-sidebar-border flex h-16 items-center border-b px-5"
        >
          <Brand inverted />
        </Link>
        <SidebarNav />
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="bg-sidebar lg:hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{t('mainNavigation')}</DialogTitle>
          <div className="border-sidebar-border flex h-16 items-center border-b px-5">
            <Brand inverted />
          </div>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print bg-card/90 supports-[backdrop-filter]:bg-card/75 sticky top-0 z-30 border-b backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={t('openMenu')}
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>
            <div className="hidden flex-1 md:block">
              <GlobalSearch />
            </div>
            <div className="ms-auto flex items-center gap-1 sm:gap-2">
              <LanguageSwitcher className="hidden sm:inline-flex" />
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
          <div className="flex items-center gap-3 border-t px-4 py-2 sm:px-6">
            <Breadcrumbs />
          </div>
          <div className="border-t px-4 py-2 md:hidden">
            <GlobalSearch />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
