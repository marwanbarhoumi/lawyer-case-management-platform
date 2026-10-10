import Link from 'next/link';
import { CalendarCheck2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Brand } from '@/components/layout/brand';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth');
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="bg-navy relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,oklch(0.74_0.12_80/0.16),transparent_50%)]"
        />
        <Link href="/" className="relative w-fit">
          <Brand inverted />
        </Link>
        <div className="relative max-w-md">
          <CalendarCheck2 className="text-gold size-10" aria-hidden />
          <p className="font-display mt-6 text-4xl leading-tight font-bold">
            {t('sidePanelTitle')}
          </p>
          <p className="mt-4 text-white/70">{t('sidePanelText')}</p>
        </div>
        <div className="bg-gold/60 relative h-px w-24" aria-hidden />
      </aside>
      <main id="main" className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Link href="/" className="lg:hidden">
            <Brand />
          </Link>
          <LanguageSwitcher variant="outline" />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
